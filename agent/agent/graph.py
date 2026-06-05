import json
import os
from typing import Any

from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt

from agent.plan_schema import LessonPlan, PlanGenerationError
from agent.state import AgentState


def generate_plan(pdf_text: str) -> LessonPlan:
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1")
    llm = ChatOpenAI(model=model, temperature=0).with_structured_output(LessonPlan)
    prompt = (
        "Create a lesson plan from the following educational content. "
        "Return exactly 3 to 5 learning objectives, each with a title, "
        "a one-sentence description, and a difficulty of beginner, intermediate, or advanced.\n\n"
        f"Content:\n{pdf_text}"
    )
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
    plan = generate_plan(pdf_text)
    return {"lesson_plan": plan.model_dump()}


def _parse_resume(raw: Any) -> dict:
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {}
    if isinstance(raw, dict):
        return raw
    return {}


def approve(state: AgentState) -> dict:
    plan = state.get("lesson_plan")
    raw = interrupt({"type": "plan_approval", "content": plan})
    decision = _parse_resume(raw)
    if decision.get("decision") == "revise":
        return {"revision_feedback": decision.get("feedback", "")}
    return {"revision_feedback": None}


def build_graph(checkpointer: Any = None):
    builder = StateGraph(AgentState)
    builder.add_node("ingest_plan", ingest_plan)
    builder.set_entry_point("ingest_plan")
    builder.add_edge("ingest_plan", END)
    return builder.compile(checkpointer=checkpointer)
