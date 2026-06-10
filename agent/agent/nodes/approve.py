from langgraph.types import interrupt

from agent.errors import PlanApprovalError
from agent.state import AgentState
from agent.utils import _parse_resume


def approve(state: AgentState) -> dict:
    plan = state.get("lesson_plan")
    while True:
        raw = interrupt({"type": "plan_approval", "content": plan})
        decision = _parse_resume(raw)
        d = decision.get("decision")
        if d == "revise":
            return {"revision_feedback": decision.get("feedback", "")}
        if d == "approve":
            return {"revision_feedback": None}
        raise PlanApprovalError(f"Invalid approval decision: {d!r}")


def route_after_approve(state: AgentState) -> str:
    return "ingest_plan" if state.get("revision_feedback") is not None else "prebatch_mcqs"
