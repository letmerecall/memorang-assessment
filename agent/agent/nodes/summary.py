from langgraph.types import interrupt

from agent.errors import SummaryGenerationError
from agent.state import AgentState
from agent.utils import invoke_with_content_retry, make_llm


def _generate_tips(weak_objectives: list[str], pdf_text: str) -> str:
    llm = make_llm(temperature=0.7)
    objectives_str = "\n".join(f"- {obj}" for obj in weak_objectives)
    prompt = (
        f"A student completed a quiz and struggled with these objectives:\n{objectives_str}\n\n"
        f"Based on the source material below, provide 2-3 specific, actionable study tips "
        f"to help them improve on these topics.\n\nSource material:\n{pdf_text[:3000]}"
    )
    return invoke_with_content_retry(llm, prompt, SummaryGenerationError)


def summary(state: AgentState) -> dict:
    results = list(state.get("results") or [])
    n = len(results)
    score = sum(1 for r in results if r.get("correct_first_try")) / n if n > 0 else 0.0

    weak = [
        r["objective"]
        for r in results
        if not r.get("correct_first_try") or r.get("asked_tutor")
    ]

    if weak:
        tips = _generate_tips(weak, state.get("pdf_text") or "")
    else:
        tips = "Great job! You answered all questions correctly on the first try."

    interrupt({"type": "summary", "content": {"score": score, "results": results, "tips": tips}})
    return {}
