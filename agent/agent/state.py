from typing import Optional
from copilotkit import CopilotKitState


class AgentState(CopilotKitState):
    pdf_text: Optional[str] = None
    lesson_plan: Optional[dict] = None
    revision_feedback: Optional[str] = None
    current_idx: int = 0
    current_mcq: Optional[dict] = None
    attempts: int = 0
    results: Optional[list[dict]] = None
    last_answer: Optional[dict] = None
    last_grade: Optional[dict] = None
    asked_tutor: bool = False
    last_tutor_reply: Optional[str] = None
    phase: Optional[str] = None
    error_message: Optional[str] = None
