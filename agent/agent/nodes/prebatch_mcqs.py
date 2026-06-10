import os
from concurrent.futures import ThreadPoolExecutor

from agent.mcq_public import split_mcq
from agent.mcq_schema import MCQ, MCQGenerationError
from agent.nodes.generate_mcq import _shuffle_mcq
from agent.pdf import trim_to_budget
from agent.state import AgentState
from agent.utils import invoke_with_validation_retry, make_llm


def _generate_one(objective: dict, pdf_text: str) -> dict:
    llm = make_llm(
        temperature=0,
        structured_output=MCQ,
        model=os.environ.get("OPENAI_MCQ_MODEL", "openai/gpt-4o-mini"),
    )
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
    full = _shuffle_mcq(mcq)
    public, key = split_mcq(full)
    return {"current_mcq": public, "mcq_key": key}


def prebatch_mcqs(state: AgentState) -> dict:
    objectives = (state.get("lesson_plan") or {}).get("objectives", [])
    pdf_text = trim_to_budget(state.get("pdf_text") or "")
    with ThreadPoolExecutor() as executor:
        queue = list(executor.map(lambda o: _generate_one(o, pdf_text), objectives))
    return {"mcq_queue": queue}
