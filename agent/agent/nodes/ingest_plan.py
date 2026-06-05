import os

from langchain_openai import ChatOpenAI

from agent.plan_schema import LessonPlan, PlanGenerationError
from agent.state import AgentState


def generate_plan(pdf_text: str, feedback: str | None = None) -> LessonPlan:
    model = os.environ.get("OPENAI_MODEL", "openai/gpt-4.1")
    base_url = os.environ.get("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    llm = ChatOpenAI(
        model=model,
        temperature=0,
        base_url=base_url,
    ).with_structured_output(LessonPlan)
    prompt = (
        "Create a lesson plan from the following educational content. "
        "Return exactly 3 to 5 learning objectives, each with a title, "
        "a one-sentence description, and a difficulty of beginner, intermediate, or advanced.\n\n"
        f"Content:\n{pdf_text}"
    )
    if feedback:
        prompt += f"\n\nPrevious feedback to incorporate: {feedback}"
    try:
        return llm.invoke(prompt)
    except Exception as first_err:
        retry_prompt = (
            f"{prompt}\n\nYour previous response was invalid: {first_err}. "
            "Ensure objectives list has 3-5 items and difficulty is one of: "
            "beginner, intermediate, advanced."
        )
        try:
            return llm.invoke(retry_prompt)
        except Exception as second_err:
            raise PlanGenerationError(str(second_err)) from second_err


def ingest_plan(state: AgentState) -> dict:
    pdf_text = state.get("pdf_text")
    if not pdf_text:
        return {}
    feedback = state.get("revision_feedback")
    plan = generate_plan(pdf_text, feedback)
    return {"lesson_plan": plan.model_dump(), "revision_feedback": None}
