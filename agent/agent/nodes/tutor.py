import os

from langchain_core.messages import AIMessage
from langchain_openai import ChatOpenAI

from agent.state import AgentState


def tutor(state: AgentState) -> dict:
    model = os.environ.get("OPENAI_MODEL", "openai/gpt-4.1")
    base_url = os.environ.get("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    llm = ChatOpenAI(model=model, temperature=0.7, base_url=base_url)

    mcq = state["current_mcq"]
    question = mcq["question"]
    options: list[str] = mcq["options"]
    correct_index: int = mcq["correct_index"]
    # Guardrail by construction: exclude the correct option, correct_index, and explanation
    wrong_options = [opt for i, opt in enumerate(options) if i != correct_index]
    pdf_text = (state.get("pdf_text") or "")[:3000]
    user_question = (state.get("last_answer") or {}).get("text", "")

    wrong_options_text = "\n".join(f"- {opt}" for opt in wrong_options)
    prompt = (
        f"You are a helpful tutor. A student is working on the following question:\n\n"
        f"Question: {question}\n\n"
        f"Incorrect options to rule out:\n{wrong_options_text}\n\n"
        f"The student asked: {user_question}\n\n"
        f"Using only the context below, give a concise hint that guides the student toward the "
        f"correct answer without naming it. Encourage them to try the question again.\n"
        f"If the student asks directly which option is correct or requests the answer, "
        f"do not reveal it — instead redirect them to think through the question using the context.\n\n"
        f"Context:\n{pdf_text}"
    )

    response = llm.invoke(prompt).content
    return {
        "messages": [AIMessage(content=response)],
        "asked_tutor": True,
        "last_tutor_reply": response,
    }
