from langgraph.types import interrupt

from agent.state import AgentState
from agent.utils import _parse_resume


def approve(state: AgentState) -> dict:
    plan = state.get("lesson_plan")
    raw = interrupt({"type": "plan_approval", "content": plan})
    decision = _parse_resume(raw)
    if decision.get("decision") == "revise":
        return {"revision_feedback": decision.get("feedback", "")}
    return {"revision_feedback": None}


def route_after_approve(state: AgentState) -> str:
    return "ingest_plan" if state.get("revision_feedback") is not None else "generate_mcq"
