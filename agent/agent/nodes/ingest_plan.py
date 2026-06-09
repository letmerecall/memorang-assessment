from agent.plan_schema import LessonPlan, PlanGenerationError
from agent.pdf import trim_to_budget
from agent.state import AgentState
from agent.utils import invoke_with_validation_retry, make_llm


def generate_plan(pdf_text: str, feedback: str | None = None) -> LessonPlan:
    llm = make_llm(temperature=0, structured_output=LessonPlan)
    prompt = (
        "Create a lesson plan from the following educational content. "
        "Return exactly 3 to 5 learning objectives, each with a title, "
        "a one-sentence description, and a difficulty of beginner, intermediate, or advanced.\n\n"
        f"Content:\n{pdf_text}"
    )
    if feedback:
        prompt += f"\n\nPrevious feedback to incorporate: {feedback}"

    def retry_suffix(base_prompt: str, first_err: Exception) -> str:
        return (
            f"{base_prompt}\n\nYour previous response was invalid: {first_err}. "
            "Ensure objectives list has 3-5 items and difficulty is one of: "
            "beginner, intermediate, advanced."
        )

    return invoke_with_validation_retry(llm, prompt, retry_suffix, PlanGenerationError)


def ingest_plan(state: AgentState) -> dict:
    pdf_text = state.get("pdf_text")
    if not pdf_text:
        raise PlanGenerationError("No PDF text in state")
    feedback = state.get("revision_feedback")
    plan = generate_plan(trim_to_budget(pdf_text), feedback)
    return {"lesson_plan": plan.model_dump(), "revision_feedback": None}
