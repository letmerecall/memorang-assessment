import random

from agent.mcq_schema import MCQGenerationError
from agent.state import AgentState


def _shuffle_mcq(mcq) -> dict:
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
    queue = list(state.get("mcq_queue") or [])
    if not queue:
        raise MCQGenerationError("MCQ queue is empty")
    item = queue.pop(0)
    return {
        "current_mcq": item["current_mcq"],
        "mcq_key": item["mcq_key"],
        "mcq_queue": queue,
        "attempts": 0,
        "last_grade": None,
        "asked_tutor": False,
        "last_tutor_reply": None,
    }
