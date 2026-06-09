import random

from agent.mcq_schema import MCQ, MCQGenerationError
from agent.pdf import trim_to_budget
from agent.state import AgentState
from agent.utils import invoke_with_validation_retry, make_llm


def _shuffle_mcq(mcq: MCQ) -> dict:
    """Return mcq as a dict with options shuffled and correct_index updated to match.

    Seeded by the question text so the same MCQ always produces the same shuffle
    (useful for debugging and for idempotent re-runs of the same LLM output).
    """
    options = list(mcq.options)
    correct_text = options[mcq.correct_index]

    rng = random.Random(mcq.question)
    rng.shuffle(options)

    data = mcq.model_dump()
    data["options"] = options
    data["correct_index"] = options.index(correct_text)
    return data


def generate_mcq(state: AgentState) -> dict:
    llm = make_llm(temperature=0, structured_output=MCQ)

    objectives = (state.get("lesson_plan") or {}).get("objectives", [])
    current_idx = state.get("current_idx", 0)
    if current_idx < 0 or current_idx >= len(objectives):
        raise MCQGenerationError(
            f"Objective index {current_idx} out of range (have {len(objectives)} objectives)"
        )
    objective = objectives[current_idx]
    pdf_text = trim_to_budget(state.get("pdf_text") or "")

    prompt = (
        f"Generate a multiple-choice question about the following learning objective:\n"
        f"'{objective['title']}' — {objective['description']}\n\n"
        f"The question must be answerable solely from the text below. "
        f"Return: question, exactly 4 options, correct_index (0–3), explanation of the correct answer, "
        f"a hint that does not reveal the answer, and source_quote (the exact passage the question derives from).\n\n"
        f"Text:\n{pdf_text}"
    )

    def retry_suffix(base_prompt: str, first_err: Exception) -> str:
        return (
            f"{base_prompt}\n\nYour previous response was invalid: {first_err}. "
            "Ensure options has exactly 4 items and correct_index is between 0 and 3."
        )

    mcq = invoke_with_validation_retry(llm, prompt, retry_suffix, MCQGenerationError)

    return {
        "current_mcq": _shuffle_mcq(mcq),
        "attempts": 0,
        "last_grade": None,
        "asked_tutor": False,
        "last_tutor_reply": None,
    }
