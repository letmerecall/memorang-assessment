import pytest
from pydantic import ValidationError
from agent.mcq_schema import MCQ, MCQResult


def _valid():
    return {
        "question": "What is X?",
        "options": ["A", "B", "C", "D"],
        "correct_index": 0,
        "explanation": "Because A.",
        "hint": "Think about it.",
        "source_quote": "X is defined as A.",
    }


def test_mcq_valid():
    mcq = MCQ(**_valid())
    assert len(mcq.options) == 4
    assert mcq.correct_index == 0


def test_mcq_three_options_raises():
    data = _valid()
    data["options"] = ["A", "B", "C"]
    with pytest.raises(ValidationError):
        MCQ(**data)


def test_mcq_correct_index_out_of_range_raises():
    data = _valid()
    data["correct_index"] = 4
    with pytest.raises(ValidationError):
        MCQ(**data)


def test_mcq_missing_source_quote_raises():
    data = _valid()
    del data["source_quote"]
    with pytest.raises(ValidationError):
        MCQ(**data)


def test_mcq_result_valid():
    r = MCQResult(objective="Topic A", correct_first_try=True, attempts=1)
    assert r.correct_first_try is True
    assert r.attempts == 1


def test_mcq_result_asked_tutor_defaults_to_false():
    r = MCQResult(objective="T", correct_first_try=True, attempts=1)
    assert r.asked_tutor is False


def test_mcq_result_asked_tutor_can_be_set():
    r = MCQResult(objective="T", correct_first_try=False, attempts=2, asked_tutor=True)
    assert r.asked_tutor is True
