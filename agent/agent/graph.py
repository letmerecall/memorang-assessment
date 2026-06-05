from typing import Any

from langgraph.graph import StateGraph, END

from agent.state import AgentState
from agent.nodes.ingest_plan import generate_plan, ingest_plan  # noqa: F401 — backward-compat re-export for tests
from agent.nodes.approve import approve, route_after_approve  # noqa: F401 — backward-compat re-export for tests
from agent.nodes.generate_mcq import generate_mcq
from agent.nodes.ask_mcq import ask_mcq
from agent.nodes.grade import grade, route_mcq, route_after_grade
from agent.nodes.summary import summary
from agent.utils import _parse_resume  # noqa: F401 — backward-compat re-export for tests


def build_graph(checkpointer: Any = None):
    builder = StateGraph(AgentState)
    builder.add_node("ingest_plan", ingest_plan)
    builder.add_node("approve", approve)
    builder.add_node("generate_mcq", generate_mcq)
    builder.add_node("ask_mcq", ask_mcq)
    builder.add_node("grade", grade)
    builder.add_node("summary", summary)
    builder.set_entry_point("ingest_plan")
    builder.add_edge("ingest_plan", "approve")
    builder.add_conditional_edges(
        "approve",
        route_after_approve,
        {"ingest_plan": "ingest_plan", "generate_mcq": "generate_mcq"},
    )
    builder.add_edge("generate_mcq", "ask_mcq")
    builder.add_conditional_edges(
        "ask_mcq",
        route_mcq,
        {"grade": "grade", "tutor": END},
    )
    builder.add_conditional_edges(
        "grade",
        route_after_grade,
        {"generate_mcq": "generate_mcq", "summary": "summary", "ask_mcq": "ask_mcq"},
    )
    builder.add_edge("summary", END)
    return builder.compile(checkpointer=checkpointer)
