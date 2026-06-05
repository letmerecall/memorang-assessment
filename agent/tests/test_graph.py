"""
Tests for the disposable spike graph and its components.
All LangGraph checkpointer calls are mocked — only deterministic logic is tested.
"""
import pytest
from unittest.mock import patch, MagicMock
from agent.state import SpikeState
from agent.graph import echo_node, build_graph


def test_spike_state_has_echo_field():
    state = SpikeState(messages=[], echo="")
    assert state["echo"] == ""


def test_spike_state_echo_stores_value():
    state = SpikeState(messages=[], echo="hello")
    assert state["echo"] == "hello"


def test_echo_node_stores_resumed_value():
    """echo_node must store the interrupt resume value into state['echo']."""
    resume_value = "round-trip confirmed"

    with patch("agent.graph.interrupt", return_value=resume_value):
        result = echo_node(SpikeState(messages=[], echo=""))

    assert result["echo"] == resume_value


def test_graph_compiles_with_memory_checkpointer():
    """Spike graph must compile without error when given any checkpointer."""
    from langgraph.checkpoint.memory import MemorySaver

    graph = build_graph(checkpointer=MemorySaver())
    assert graph is not None
