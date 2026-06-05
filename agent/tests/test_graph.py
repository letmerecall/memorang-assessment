"""Tests for AgentState and graph components."""
from unittest.mock import patch, call
from langgraph.graph import END
from agent.state import AgentState
from agent.graph import ingest_plan, build_graph, approve, _parse_resume, generate_plan, route_after_approve
from agent.plan_schema import LessonPlan, LearningObjective
from agent.nodes.grade import grade, route_mcq, route_after_grade
from agent.nodes.ask_mcq import ask_mcq


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


def test_route_after_approve_routes_to_end_when_no_feedback():
    state = AgentState(messages=[], revision_feedback=None)
    assert route_after_approve(state) == END


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

def test_route_after_grade_correct_routes_to_end():
    state = AgentState(
        messages=[],
        last_grade={"correct": True, "explanation": "...", "source_quote": "..."},
    )
    assert route_after_grade(state) == END


def test_route_after_grade_incorrect_routes_to_ask_mcq():
    state = AgentState(
        messages=[],
        last_grade={"correct": False, "hint": "Think again."},
    )
    assert route_after_grade(state) == "ask_mcq"


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
