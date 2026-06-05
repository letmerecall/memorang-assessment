"""Tests for AgentState and graph components."""
from unittest.mock import patch, call
from agent.state import AgentState
from agent.graph import ingest_plan, build_graph, approve, _parse_resume, generate_plan, route_after_approve
from agent.plan_schema import LessonPlan, LearningObjective
from agent.nodes.grade import grade, route_mcq, route_after_grade
from agent.nodes.ask_mcq import ask_mcq
from agent.nodes.generate_mcq import generate_mcq
from agent.mcq_schema import MCQ


def test_agent_state_defaults():
    state = AgentState(messages=[])
    assert state.get("pdf_text") is None
    assert state.get("lesson_plan") is None


def test_agent_state_stores_pdf_text():
    state = AgentState(messages=[], pdf_text="hello pdf")
    assert state["pdf_text"] == "hello pdf"


def test_agent_state_stores_lesson_plan():
    plan = {"objectives": []}
    state = AgentState(messages=[], lesson_plan=plan)
    assert state["lesson_plan"] == plan


def _mock_plan() -> LessonPlan:
    return LessonPlan(objectives=[
        LearningObjective(title=f"T{i}", description=f"D{i}", difficulty="beginner")
        for i in range(3)
    ])


def test_ingest_plan_sets_lesson_plan_in_state():
    state = AgentState(messages=[], pdf_text="some content", lesson_plan=None)
    with patch("agent.nodes.ingest_plan.generate_plan", return_value=_mock_plan()):
        result = ingest_plan(state)
    assert result["lesson_plan"]["objectives"][0]["title"] == "T0"
    assert len(result["lesson_plan"]["objectives"]) == 3


def test_ingest_plan_skips_when_no_pdf_text():
    state = AgentState(messages=[], pdf_text=None, lesson_plan=None)
    with patch("agent.nodes.ingest_plan.generate_plan") as mock_gen:
        result = ingest_plan(state)
    mock_gen.assert_not_called()
    assert result == {}


def test_graph_compiles_with_memory_checkpointer():
    from langgraph.checkpoint.memory import MemorySaver
    graph = build_graph(checkpointer=MemorySaver())
    assert graph is not None


def test_agent_state_defaults_revision_feedback_to_none():
    state = AgentState(messages=[])
    assert state.get("revision_feedback") is None


def test_agent_state_stores_revision_feedback():
    state = AgentState(messages=[], revision_feedback="add more beginner content")
    assert state["revision_feedback"] == "add more beginner content"


def test_parse_resume_dict_passthrough():
    assert _parse_resume({"decision": "approve"}) == {"decision": "approve"}


def test_parse_resume_json_string():
    import json
    assert _parse_resume(json.dumps({"decision": "revise", "feedback": "more"})) == {
        "decision": "revise",
        "feedback": "more",
    }


def test_parse_resume_invalid_returns_empty():
    assert _parse_resume("not-json") == {}
    assert _parse_resume(None) == {}


def test_approve_calls_interrupt_with_plan_payload():
    plan = {"objectives": [{"title": "T", "description": "D", "difficulty": "beginner"}]}
    state = AgentState(messages=[], lesson_plan=plan)
    with patch("agent.nodes.approve.interrupt") as mock_interrupt:
        mock_interrupt.return_value = {"decision": "approve"}
        approve(state)
    mock_interrupt.assert_called_once_with({"type": "plan_approval", "content": plan})


def test_approve_returns_none_feedback_on_approve():
    state = AgentState(messages=[], lesson_plan={"objectives": []})
    with patch("agent.nodes.approve.interrupt", return_value={"decision": "approve"}):
        result = approve(state)
    assert result == {"revision_feedback": None}


def test_approve_returns_feedback_on_revise():
    state = AgentState(messages=[], lesson_plan={"objectives": []})
    with patch("agent.nodes.approve.interrupt", return_value={"decision": "revise", "feedback": "add diagrams"}):
        result = approve(state)
    assert result == {"revision_feedback": "add diagrams"}


def test_approve_handles_json_string_resume():
    import json
    state = AgentState(messages=[], lesson_plan={"objectives": []})
    with patch("agent.nodes.approve.interrupt", return_value=json.dumps({"decision": "revise", "feedback": "simpler"})):
        result = approve(state)
    assert result == {"revision_feedback": "simpler"}


def test_approve_empty_feedback_defaults_to_empty_string():
    state = AgentState(messages=[], lesson_plan={"objectives": []})
    with patch("agent.nodes.approve.interrupt", return_value={"decision": "revise"}):
        result = approve(state)
    assert result == {"revision_feedback": ""}


def test_ingest_plan_passes_feedback_to_generate_plan():
    state = AgentState(messages=[], pdf_text="some content", revision_feedback="add more detail")
    with patch("agent.nodes.ingest_plan.generate_plan") as mock_gen:
        mock_gen.return_value = _mock_plan()
        ingest_plan(state)
    mock_gen.assert_called_once_with("some content", "add more detail")


def test_ingest_plan_passes_none_feedback_when_not_set():
    state = AgentState(messages=[], pdf_text="some content", revision_feedback=None)
    with patch("agent.nodes.ingest_plan.generate_plan") as mock_gen:
        mock_gen.return_value = _mock_plan()
        ingest_plan(state)
    mock_gen.assert_called_once_with("some content", None)


def test_ingest_plan_clears_revision_feedback():
    state = AgentState(messages=[], pdf_text="some content", revision_feedback="old feedback")
    with patch("agent.nodes.ingest_plan.generate_plan", return_value=_mock_plan()):
        result = ingest_plan(state)
    assert result["revision_feedback"] is None


def test_generate_plan_includes_feedback_in_prompt():
    with patch("agent.nodes.ingest_plan.ChatOpenAI") as MockLLM:
        mock_instance = MockLLM.return_value.with_structured_output.return_value
        mock_instance.invoke.return_value = _mock_plan()
        generate_plan("my content", feedback="add beginner objectives")
    prompt_arg = mock_instance.invoke.call_args[0][0]
    assert "add beginner objectives" in prompt_arg


def test_generate_plan_no_feedback_omits_feedback_section():
    with patch("agent.nodes.ingest_plan.ChatOpenAI") as MockLLM:
        mock_instance = MockLLM.return_value.with_structured_output.return_value
        mock_instance.invoke.return_value = _mock_plan()
        generate_plan("my content", feedback=None)
    prompt_arg = mock_instance.invoke.call_args[0][0]
    assert "Previous feedback" not in prompt_arg


def test_route_after_approve_routes_to_ingest_plan_when_feedback_set():
    state = AgentState(messages=[], revision_feedback="more examples please")
    assert route_after_approve(state) == "ingest_plan"


def test_route_after_approve_routes_to_generate_mcq_when_no_feedback():
    state = AgentState(messages=[], revision_feedback=None)
    assert route_after_approve(state) == "generate_mcq"


def test_graph_has_approve_node():
    from langgraph.checkpoint.memory import MemorySaver
    graph = build_graph(checkpointer=MemorySaver())
    assert "approve" in graph.get_graph().nodes


# ── grade ──────────────────────────────────────────────────────────────

def _mcq_dict():
    return {
        "question": "Q?",
        "options": ["A", "B", "C", "D"],
        "correct_index": 2,
        "explanation": "Because C.",
        "hint": "Think about C.",
        "source_quote": "C is correct.",
    }


def _plan_with_one_objective():
    return {
        "objectives": [
            {"title": "Topic A", "description": "Learn A.", "difficulty": "beginner"}
        ]
    }


def test_grade_correct_first_attempt():
    state = AgentState(
        messages=[],
        lesson_plan=_plan_with_one_objective(),
        current_idx=0,
        current_mcq=_mcq_dict(),
        attempts=0,
        results=None,
        last_answer={"kind": "answer", "index": 2},
    )
    result = grade(state)
    assert result["last_grade"]["correct"] is True
    assert result["last_grade"]["explanation"] == "Because C."
    assert result["last_grade"]["source_quote"] == "C is correct."
    assert result["attempts"] == 1
    assert result["current_idx"] == 1
    assert len(result["results"]) == 1
    assert result["results"][0]["correct_first_try"] is True
    assert result["results"][0]["attempts"] == 1
    assert result["results"][0]["objective"] == "Topic A"


def test_grade_incorrect_first_attempt():
    state = AgentState(
        messages=[],
        lesson_plan=_plan_with_one_objective(),
        current_idx=0,
        current_mcq=_mcq_dict(),
        attempts=0,
        results=None,
        last_answer={"kind": "answer", "index": 0},
    )
    result = grade(state)
    assert result["last_grade"]["correct"] is False
    assert result["last_grade"]["hint"] == "Think about C."
    assert result["attempts"] == 1
    assert "results" not in result
    assert "current_idx" not in result


def test_grade_correct_second_attempt_not_first_try():
    state = AgentState(
        messages=[],
        lesson_plan=_plan_with_one_objective(),
        current_idx=0,
        current_mcq=_mcq_dict(),
        attempts=1,
        results=None,
        last_answer={"kind": "answer", "index": 2},
    )
    result = grade(state)
    assert result["results"][0]["correct_first_try"] is False
    assert result["results"][0]["attempts"] == 2


def test_grade_appends_to_existing_results():
    existing = [{"objective": "Old", "correct_first_try": True, "attempts": 1}]
    state = AgentState(
        messages=[],
        lesson_plan=_plan_with_one_objective(),
        current_idx=0,
        current_mcq=_mcq_dict(),
        attempts=0,
        results=existing,
        last_answer={"kind": "answer", "index": 2},
    )
    result = grade(state)
    assert len(result["results"]) == 2


# ── route_mcq ──────────────────────────────────────────────────────────

def test_route_mcq_answer_routes_to_grade():
    state = AgentState(messages=[], last_answer={"kind": "answer", "index": 1})
    assert route_mcq(state) == "grade"


def test_route_mcq_question_routes_to_tutor():
    state = AgentState(messages=[], last_answer={"kind": "question", "text": "help me"})
    assert route_mcq(state) == "tutor"


def test_route_mcq_missing_kind_defaults_to_grade():
    state = AgentState(messages=[], last_answer={"index": 1})
    assert route_mcq(state) == "grade"


# ── route_after_grade ──────────────────────────────────────────────────

def test_route_after_grade_correct_no_plan_routes_to_summary():
    state = AgentState(
        messages=[],
        last_grade={"correct": True, "explanation": "...", "source_quote": "..."},
    )
    assert route_after_grade(state) == "summary"


def test_route_after_grade_incorrect_routes_to_ask_mcq():
    state = AgentState(
        messages=[],
        last_grade={"correct": False, "hint": "Think again."},
    )
    assert route_after_grade(state) == "ask_mcq"


def test_route_after_grade_correct_more_objectives_routes_to_generate_mcq():
    state = AgentState(
        messages=[],
        lesson_plan={
            "objectives": [
                {"title": "T0", "description": "D0", "difficulty": "beginner"},
                {"title": "T1", "description": "D1", "difficulty": "beginner"},
                {"title": "T2", "description": "D2", "difficulty": "beginner"},
            ]
        },
        current_idx=1,
        last_grade={"correct": True, "explanation": "...", "source_quote": "..."},
    )
    assert route_after_grade(state) == "generate_mcq"


def test_route_after_grade_correct_all_done_routes_to_summary():
    state = AgentState(
        messages=[],
        lesson_plan={
            "objectives": [
                {"title": "T0", "description": "D0", "difficulty": "beginner"},
                {"title": "T1", "description": "D1", "difficulty": "beginner"},
                {"title": "T2", "description": "D2", "difficulty": "beginner"},
            ]
        },
        current_idx=3,
        last_grade={"correct": True, "explanation": "...", "source_quote": "..."},
    )
    assert route_after_grade(state) == "summary"


# ── ask_mcq ────────────────────────────────────────────────────────────

def test_ask_mcq_calls_interrupt_with_mcq_payload():
    mcq = _mcq_dict()
    state = AgentState(messages=[], current_mcq=mcq, last_grade=None)
    with patch("agent.nodes.ask_mcq.interrupt") as mock_interrupt:
        mock_interrupt.return_value = {"kind": "answer", "index": 1}
        result = ask_mcq(state)
    mock_interrupt.assert_called_once_with({"type": "mcq", "content": mcq, "feedback": None})
    assert result["last_answer"] == {"kind": "answer", "index": 1}


def test_ask_mcq_passes_last_grade_as_feedback_on_retry():
    mcq = _mcq_dict()
    last_grade = {"correct": False, "hint": "Think about C."}
    state = AgentState(messages=[], current_mcq=mcq, last_grade=last_grade)
    with patch("agent.nodes.ask_mcq.interrupt") as mock_interrupt:
        mock_interrupt.return_value = {"kind": "answer", "index": 2}
        result = ask_mcq(state)
    mock_interrupt.assert_called_once_with({"type": "mcq", "content": mcq, "feedback": last_grade})
    assert result["last_answer"]["index"] == 2


def test_ask_mcq_parses_json_string_resume():
    import json
    mcq = _mcq_dict()
    state = AgentState(messages=[], current_mcq=mcq, last_grade=None)
    with patch("agent.nodes.ask_mcq.interrupt") as mock_interrupt:
        mock_interrupt.return_value = json.dumps({"kind": "answer", "index": 3})
        result = ask_mcq(state)
    assert result["last_answer"] == {"kind": "answer", "index": 3}


# ── generate_mcq ───────────────────────────────────────────────────────

def _mock_mcq_model():
    return MCQ(
        question="Q?",
        options=["A", "B", "C", "D"],
        correct_index=1,
        explanation="Exp.",
        hint="Hint.",
        source_quote="Quote.",
    )


def test_generate_mcq_resets_attempts_and_clears_last_grade():
    state = AgentState(
        messages=[],
        pdf_text="some educational text",
        lesson_plan={
            "objectives": [
                {"title": "Topic A", "description": "Learn A.", "difficulty": "beginner"}
            ]
        },
        current_idx=0,
        attempts=3,
        last_grade={"correct": False, "hint": "old hint"},
    )
    with patch("agent.nodes.generate_mcq.ChatOpenAI") as MockLLM:
        mock_instance = MockLLM.return_value.with_structured_output.return_value
        mock_instance.invoke.return_value = _mock_mcq_model()
        result = generate_mcq(state)
    assert result["attempts"] == 0
    assert result["last_grade"] is None
    assert result["current_mcq"]["question"] == "Q?"
    assert result["current_mcq"]["options"] == ["A", "B", "C", "D"]
    assert result["current_mcq"]["correct_index"] == 1


def test_generate_mcq_includes_objective_and_pdf_in_prompt():
    state = AgentState(
        messages=[],
        pdf_text="the content",
        lesson_plan={
            "objectives": [
                {"title": "Topic A", "description": "Learn A.", "difficulty": "beginner"}
            ]
        },
        current_idx=0,
        attempts=0,
        last_grade=None,
    )
    with patch("agent.nodes.generate_mcq.ChatOpenAI") as MockLLM:
        mock_instance = MockLLM.return_value.with_structured_output.return_value
        mock_instance.invoke.return_value = _mock_mcq_model()
        generate_mcq(state)
    prompt = mock_instance.invoke.call_args[0][0]
    assert "Topic A" in prompt
    assert "the content" in prompt


# ── summary ────────────────────────────────────────────────────────────

from agent.nodes.summary import summary


def _three_results(*, weak_idx: int | None = None) -> list[dict]:
    results = []
    for i in range(3):
        results.append({
            "objective": f"Topic {i}",
            "correct_first_try": True,
            "attempts": 1,
            "asked_tutor": False,
        })
    if weak_idx is not None:
        results[weak_idx]["correct_first_try"] = False
        results[weak_idx]["attempts"] = 2
    return results


def test_summary_computes_correct_score():
    results = _three_results(weak_idx=2)  # 2 of 3 correct first try → 0.667
    state = AgentState(
        messages=[],
        results=results,
        pdf_text="content",
        lesson_plan={"objectives": []},
    )
    with patch("agent.nodes.summary.interrupt") as mock_interrupt, \
         patch("agent.nodes.summary.ChatOpenAI") as MockLLM:
        mock_instance = MockLLM.return_value
        mock_instance.invoke.return_value.content = "Study Topic 2."
        summary(state)
    payload = mock_interrupt.call_args[0][0]
    assert abs(payload["content"]["score"] - 2 / 3) < 0.001
    assert payload["type"] == "summary"


def test_summary_tips_prompt_includes_weak_objective():
    results = _three_results(weak_idx=1)  # Topic 1 is weak
    state = AgentState(
        messages=[],
        results=results,
        pdf_text="the content",
        lesson_plan={"objectives": []},
    )
    with patch("agent.nodes.summary.interrupt"), \
         patch("agent.nodes.summary.ChatOpenAI") as MockLLM:
        mock_instance = MockLLM.return_value
        mock_instance.invoke.return_value.content = "Review Topic 1."
        summary(state)
    prompt = mock_instance.invoke.call_args[0][0]
    assert "Topic 1" in prompt
    assert "Topic 0" not in prompt
    assert "Topic 2" not in prompt


def test_summary_skips_llm_when_all_correct_first_try():
    results = _three_results()  # all correct first try
    state = AgentState(
        messages=[],
        results=results,
        pdf_text="content",
        lesson_plan={"objectives": []},
    )
    with patch("agent.nodes.summary.interrupt") as mock_interrupt, \
         patch("agent.nodes.summary.ChatOpenAI") as MockLLM:
        summary(state)
    MockLLM.assert_not_called()
    payload = mock_interrupt.call_args[0][0]
    assert "Great job" in payload["content"]["tips"]
    assert payload["content"]["score"] == 1.0


def test_summary_results_passed_through_in_payload():
    results = _three_results(weak_idx=0)
    state = AgentState(
        messages=[],
        results=results,
        pdf_text="content",
        lesson_plan={"objectives": []},
    )
    with patch("agent.nodes.summary.interrupt") as mock_interrupt, \
         patch("agent.nodes.summary.ChatOpenAI") as MockLLM:
        mock_instance = MockLLM.return_value
        mock_instance.invoke.return_value.content = "Tips."
        summary(state)
    payload = mock_interrupt.call_args[0][0]
    assert payload["content"]["results"] == results
