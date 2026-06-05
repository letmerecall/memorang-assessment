from typing import Literal
from pydantic import BaseModel, Field


Difficulty = Literal["beginner", "intermediate", "advanced"]


class LearningObjective(BaseModel):
    title: str
    description: str
    difficulty: Difficulty


class LessonPlan(BaseModel):
    objectives: list[LearningObjective] = Field(min_length=3, max_length=5)


class PlanGenerationError(RuntimeError):
    pass
