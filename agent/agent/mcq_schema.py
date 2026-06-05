from pydantic import BaseModel, Field


class MCQ(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str
    hint: str
    source_quote: str


class MCQResult(BaseModel):
    objective: str
    correct_first_try: bool
    attempts: int


class MCQGenerationError(RuntimeError):
    pass
