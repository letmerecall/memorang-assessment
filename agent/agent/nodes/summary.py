import os

from langgraph.types import interrupt
from langchain_openai import ChatOpenAI

from agent.state import AgentState


def _generate_tips(weak_objectives: list[str], pdf_text: str) -> str:
    model = os.environ.get("OPENAI_MODEL", "openai/gpt-4.1")
    base_url = os.environ.get("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    # temperature=0.7 for creative/varied tips; contrast with temperature=0 used in generate_mcq
    llm = ChatOpenAI(model=model, temperature=0.7, base_url=base_url)
    objectives_str = "\n".join(f"- {obj}" for obj in weak_objectives)
    prompt = (
        f"A student completed a quiz and struggled with these objectives:\n{objectives_str}\n\n"
        f"Based on the source material below, provide 2-3 specific, actionable study tips "
        f"to help them improve on these topics.\n\nSource material:\n{pdf_text[:3000]}"
    )
    try:
        return llm.invoke(prompt).content
    except Exception as first_err:
        try:
            return llm.invoke(prompt).content
        except Exception as second_err:
            raise RuntimeError(str(second_err)) from first_err


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
