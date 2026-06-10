from langchain_core.messages import AIMessage

from agent.errors import TutorError
from agent.state import AgentState
from agent.utils import invoke_with_content_retry, make_llm


def tutor(state: AgentState) -> dict:
    llm = make_llm(temperature=0.7)

    mcq = state["current_mcq"]
    question = mcq["question"]
    pdf_text = (state.get("pdf_text") or "")[:3000]
    user_question = (state.get("last_answer") or {}).get("text", "")

    prompt = (
        f"You are a helpful tutor. A student is working on the following multiple-choice question:\n\n"
        f"Question: {question}\n\n"
        f"The student asked: {user_question}\n\n"
        f"Using only the context below, give a concise hint that guides the student toward the "
        f"correct answer without naming or quoting any answer option. Encourage them to try the question again.\n"
        f"If the student asks directly which option is correct or requests the answer, "
        f"do not reveal it — instead redirect them to think through the question using the context.\n\n"
        f"Context:\n{pdf_text}"
    )

    response = invoke_with_content_retry(llm, prompt, TutorError)
    return {
        "messages": [AIMessage(content=response)],
        "asked_tutor": True,
        "last_tutor_reply": response,
    }
