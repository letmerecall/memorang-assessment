"""Tests for AgentState and graph components."""
import pytest
from agent.state import AgentState


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


from unittest.mock import patch
from agent.graph import ingest_plan, build_graph
from agent.plan_schema import LessonPlan, LearningObjective


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
