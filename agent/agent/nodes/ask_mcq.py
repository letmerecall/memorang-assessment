from langgraph.types import interrupt

from agent.mcq_public import public_mcq
from agent.state import AgentState
from agent.utils import _parse_resume


def ask_mcq(state: AgentState) -> dict:
    mcq = state.get("current_mcq")
    last_grade = state.get("last_grade")
    raw = interrupt(
        {
            "type": "mcq",
            "content": public_mcq(mcq),
            "feedback": last_grade,
            "tutor_reply": state.get("last_tutor_reply"),
        }
    )
    return {"last_answer": _parse_resume(raw)}
