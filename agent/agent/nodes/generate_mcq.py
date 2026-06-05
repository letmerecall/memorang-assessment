import os

from langchain_openai import ChatOpenAI

from agent.mcq_schema import MCQ, MCQGenerationError
from agent.state import AgentState


def generate_mcq(state: AgentState) -> dict:
    model = os.environ.get("OPENAI_MODEL", "openai/gpt-4.1")
    base_url = os.environ.get("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    llm = ChatOpenAI(
        model=model,
        temperature=0,
        base_url=base_url,
    ).with_structured_output(MCQ)

    objectives = (state.get("lesson_plan") or {}).get("objectives", [])
    current_idx = state.get("current_idx", 0)
    objective = objectives[current_idx]
    pdf_text = state.get("pdf_text", "")

    prompt = (
        f"Generate a multiple-choice question about the following learning objective:\n"
        f"'{objective['title']}' — {objective['description']}\n\n"
        f"The question must be answerable solely from the text below. "
        f"Return: question, exactly 4 options, correct_index (0–3), explanation of the correct answer, "
        f"a hint that does not reveal the answer, and source_quote (the exact passage the question derives from).\n\n"
        f"Text:\n{pdf_text}"
    )

    try:
        mcq = llm.invoke(prompt)
    except Exception as first_err:
        retry_prompt = (
            f"{prompt}\n\nYour previous response was invalid: {first_err}. "
            "Ensure options has exactly 4 items and correct_index is between 0 and 3."
        )
        try:
            mcq = llm.invoke(retry_prompt)
        except Exception as second_err:
            raise MCQGenerationError(str(second_err)) from second_err

    return {
        "current_mcq": mcq.model_dump(),
        "attempts": 0,
        "last_grade": None,
    }
