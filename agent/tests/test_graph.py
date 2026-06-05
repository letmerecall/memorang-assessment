"""Tests for AgentState and graph components."""
from unittest.mock import patch, call
from agent.state import AgentState
from agent.graph import ingest_plan, build_graph, approve, _parse_resume, generate_plan
from agent.plan_schema import LessonPlan, LearningObjective


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
    with patch("agent.graph.generate_plan", return_value=_mock_plan()):
        result = ingest_plan(state)
    assert result["lesson_plan"]["objectives"][0]["title"] == "T0"
    assert len(result["lesson_plan"]["objectives"]) == 3


def test_ingest_plan_skips_when_no_pdf_text():
    state = AgentState(messages=[], pdf_text=None, lesson_plan=None)
    with patch("agent.graph.generate_plan") as mock_gen:
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
    with patch("agent.graph.interrupt") as mock_interrupt:
        mock_interrupt.return_value = {"decision": "approve"}
        approve(state)
    mock_interrupt.assert_called_once_with({"type": "plan_approval", "content": plan})


def test_approve_returns_none_feedback_on_approve():
    state = AgentState(messages=[], lesson_plan={"objectives": []})
    with patch("agent.graph.interrupt", return_value={"decision": "approve"}):
        result = approve(state)
    assert result == {"revision_feedback": None}


def test_approve_returns_feedback_on_revise():
    state = AgentState(messages=[], lesson_plan={"objectives": []})
    with patch("agent.graph.interrupt", return_value={"decision": "revise", "feedback": "add diagrams"}):
        result = approve(state)
    assert result == {"revision_feedback": "add diagrams"}


def test_approve_handles_json_string_resume():
    import json
    state = AgentState(messages=[], lesson_plan={"objectives": []})
    with patch("agent.graph.interrupt", return_value=json.dumps({"decision": "revise", "feedback": "simpler"})):
        result = approve(state)
    assert result == {"revision_feedback": "simpler"}


def test_approve_empty_feedback_defaults_to_empty_string():
    state = AgentState(messages=[], lesson_plan={"objectives": []})
    with patch("agent.graph.interrupt", return_value={"decision": "revise"}):
        result = approve(state)
    assert result == {"revision_feedback": ""}


def test_ingest_plan_passes_feedback_to_generate_plan():
    state = AgentState(messages=[], pdf_text="some content", revision_feedback="add more detail")
    with patch("agent.graph.generate_plan") as mock_gen:
        mock_gen.return_value = _mock_plan()
        ingest_plan(state)
    mock_gen.assert_called_once_with("some content", "add more detail")


def test_ingest_plan_passes_none_feedback_when_not_set():
    state = AgentState(messages=[], pdf_text="some content", revision_feedback=None)
    with patch("agent.graph.generate_plan") as mock_gen:
        mock_gen.return_value = _mock_plan()
        ingest_plan(state)
    mock_gen.assert_called_once_with("some content", None)


def test_ingest_plan_clears_revision_feedback():
    state = AgentState(messages=[], pdf_text="some content", revision_feedback="old feedback")
    with patch("agent.graph.generate_plan", return_value=_mock_plan()):
        result = ingest_plan(state)
    assert result["revision_feedback"] is None


def test_generate_plan_includes_feedback_in_prompt():
    with patch("agent.graph.ChatOpenAI") as MockLLM:
        mock_instance = MockLLM.return_value.with_structured_output.return_value
        mock_instance.invoke.return_value = _mock_plan()
        generate_plan("my content", feedback="add beginner objectives")
    prompt_arg = mock_instance.invoke.call_args[0][0]
    assert "add beginner objectives" in prompt_arg


def test_generate_plan_no_feedback_omits_feedback_section():
    with patch("agent.graph.ChatOpenAI") as MockLLM:
        mock_instance = MockLLM.return_value.with_structured_output.return_value
        mock_instance.invoke.return_value = _mock_plan()
        generate_plan("my content", feedback=None)
    prompt_arg = mock_instance.invoke.call_args[0][0]
    assert "Previous feedback" not in prompt_arg
