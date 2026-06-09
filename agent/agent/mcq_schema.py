from pydantic import BaseModel, Field, field_validator


class MCQ(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str
    hint: str
    source_quote: str

    @field_validator("options")
    @classmethod
    def options_must_be_unique(cls, v: list[str]) -> list[str]:
        if len(v) != len(set(v)):
            raise ValueError("MCQ options must be unique")
        return v


class MCQResult(BaseModel):
    objective: str
    correct_first_try: bool
    attempts: int
    asked_tutor: bool = False


class MCQGenerationError(RuntimeError):
    pass
