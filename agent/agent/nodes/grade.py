from langgraph.graph import END

from agent.mcq_schema import MCQResult
from agent.state import AgentState


def grade(state: AgentState) -> dict:
    attempts = state.get("attempts", 0) + 1
    mcq = state["current_mcq"]
    selected = (state.get("last_answer") or {}).get("index")

    if selected == mcq["correct_index"]:
        current_idx = state.get("current_idx", 0)
        objectives = (state.get("lesson_plan") or {}).get("objectives", [])
        objective_title = objectives[current_idx]["title"] if current_idx < len(objectives) else ""
        result = MCQResult(
            objective=objective_title,
            correct_first_try=(attempts == 1),
            attempts=attempts,
        )
        existing = list(state.get("results") or [])
        existing.append(result.model_dump())
        return {
            "attempts": attempts,
            "results": existing,
            "current_idx": current_idx + 1,
            "last_grade": {
                "correct": True,
                "explanation": mcq["explanation"],
                "source_quote": mcq["source_quote"],
            },
        }
    else:
        return {
            "attempts": attempts,
            "last_grade": {"correct": False, "hint": mcq["hint"]},
        }


def route_mcq(state: AgentState) -> str:
    kind = (state.get("last_answer") or {}).get("kind")
    if kind == "question":
        return "tutor"
    return "grade"


def route_after_grade(state: AgentState) -> str:
    if (state.get("last_grade") or {}).get("correct"):
        return END
    return "ask_mcq"
