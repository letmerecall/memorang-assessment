from typing import Optional
from copilotkit import CopilotKitState


class AgentState(CopilotKitState):
    pdf_text: Optional[str]
    lesson_plan: Optional[dict]
