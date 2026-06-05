"""Tests for LessonPlan Pydantic schema — no LLM calls."""
import pytest
from pydantic import ValidationError
from agent.plan_schema import LessonPlan, LearningObjective


def _obj(title: str = "T", description: str = "D", difficulty: str = "beginner") -> dict:
    return {"title": title, "description": description, "difficulty": difficulty}


def test_lesson_plan_validates_three_objectives():
    plan = LessonPlan.model_validate({"objectives": [_obj(str(i)) for i in range(3)]})
    assert len(plan.objectives) == 3


def test_lesson_plan_validates_five_objectives():
    plan = LessonPlan.model_validate({"objectives": [_obj(str(i)) for i in range(5)]})
    assert len(plan.objectives) == 5


def test_lesson_plan_rejects_two_objectives():
    with pytest.raises(ValidationError):
        LessonPlan.model_validate({"objectives": [_obj(str(i)) for i in range(2)]})


def test_lesson_plan_rejects_six_objectives():
    with pytest.raises(ValidationError):
        LessonPlan.model_validate({"objectives": [_obj(str(i)) for i in range(6)]})


def test_lesson_plan_rejects_invalid_difficulty():
    with pytest.raises(ValidationError):
        LessonPlan.model_validate(
            {"objectives": [_obj("T", "D", "expert")] * 3}
        )


def test_learning_objective_accepts_all_difficulty_levels():
    for diff in ("beginner", "intermediate", "advanced"):
        obj = LearningObjective.model_validate(_obj("T", "D", diff))
        assert obj.difficulty == diff
