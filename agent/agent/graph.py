from typing import Any
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt
from agent.state import SpikeState


def echo_node(state: SpikeState) -> dict:
    """Interrupt and echo back whatever the frontend sends as the resume value."""
    resumed = interrupt({"type": "echo_prompt", "message": "Click the button to echo!"})
    return {"echo": resumed}


def build_graph(checkpointer: Any = None):
    builder = StateGraph(SpikeState)
    builder.add_node("echo", echo_node)
    builder.set_entry_point("echo")
    builder.add_edge("echo", END)
    return builder.compile(checkpointer=checkpointer)
