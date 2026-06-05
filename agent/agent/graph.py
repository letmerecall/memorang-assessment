from typing import Any

from langgraph.graph import StateGraph, END

from agent.state import AgentState
from agent.nodes.ingest_plan import generate_plan, ingest_plan  # noqa: F401
from agent.nodes.approve import approve, route_after_approve  # noqa: F401
from agent.utils import _parse_resume  # noqa: F401


def build_graph(checkpointer: Any = None):
    builder = StateGraph(AgentState)
    builder.add_node("ingest_plan", ingest_plan)
    builder.add_node("approve", approve)
    builder.set_entry_point("ingest_plan")
    builder.add_edge("ingest_plan", "approve")
    builder.add_conditional_edges(
        "approve",
        route_after_approve,
        {"ingest_plan": "ingest_plan", END: END},
    )
    return builder.compile(checkpointer=checkpointer)
