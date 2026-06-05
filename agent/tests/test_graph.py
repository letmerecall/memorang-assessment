"""Tests for AgentState and graph components."""
import pytest
from agent.state import AgentState


def test_agent_state_defaults():
    state = AgentState(messages=[])
    assert state["pdf_text"] is None
    assert state["lesson_plan"] is None


def test_agent_state_stores_pdf_text():
    state = AgentState(messages=[], pdf_text="hello pdf")
    assert state["pdf_text"] == "hello pdf"


def test_agent_state_stores_lesson_plan():
    plan = {"objectives": []}
    state = AgentState(messages=[], lesson_plan=plan)
    assert state["lesson_plan"] == plan
