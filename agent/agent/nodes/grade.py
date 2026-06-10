from agent.errors import GradeError
from agent.mcq_schema import MCQResult
from agent.state import AgentState


def grade(state: AgentState) -> dict:
    attempts = state.get("attempts", 0) + 1
    mcq_key = state.get("mcq_key")
    if not mcq_key:
        raise GradeError("No MCQ answer key in state")

    selected = (state.get("last_answer") or {}).get("index")

    if selected == mcq_key["correct_index"]:
        current_idx = state.get("current_idx", 0)
        objectives = (state.get("lesson_plan") or {}).get("objectives", [])
        objective_title = objectives[current_idx]["title"] if current_idx < len(objectives) else ""
        result = MCQResult(
            objective=objective_title,
            correct_first_try=(attempts == 1),
            attempts=attempts,
            asked_tutor=state.get("asked_tutor", False),
        )
        existing = list(state.get("results") or [])
        existing.append(result.model_dump())
        return {
            "attempts": attempts,
            "results": existing,
            "current_idx": current_idx + 1,
            "last_grade": {
                "correct": True,
                "explanation": mcq_key["explanation"],
                "source_quote": mcq_key["source_quote"],
                "selected_index": selected,
            },
        }
    else:
        return {
            "attempts": attempts,
            "last_grade": {
                "correct": False,
                "hint": mcq_key["hint"],
                "selected_index": selected,
            },
        }


def route_mcq(state: AgentState) -> str:
    kind = (state.get("last_answer") or {}).get("kind")
    if kind == "question":
        return "tutor"
    if kind == "continue":
        objectives = (state.get("lesson_plan") or {}).get("objectives", [])
        if state.get("current_idx", 0) < len(objectives):
            return "generate_mcq"
        return "summary"
    return "grade"


def route_after_grade(state: AgentState) -> str:
    return "ask_mcq"
