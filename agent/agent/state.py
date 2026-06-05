from typing import Optional
from typing_extensions import TypedDict
from copilotkit import CopilotKitState


class _AgentStateTypedDict(CopilotKitState):
    """TypedDict definition for AgentState."""
    pdf_text: Optional[str]
    lesson_plan: Optional[dict]


def AgentState(
    messages=None, pdf_text=None, lesson_plan=None, **kwargs
) -> _AgentStateTypedDict:
    """Create an AgentState with default None values for optional fields."""
    state: dict = {
        "messages": messages or [],
        "pdf_text": pdf_text,
        "lesson_plan": lesson_plan,
    }
    state.update(kwargs)
    return state  # type: ignore
