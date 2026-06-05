from typing import Optional
from copilotkit import CopilotKitState


class AgentState(CopilotKitState):
    pdf_text: Optional[str] = None
    lesson_plan: Optional[dict] = None
    revision_feedback: Optional[str] = None
