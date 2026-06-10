"""Tests for MCQ public/private split helpers."""
from agent.mcq_public import public_mcq, split_mcq


def test_public_mcq_strips_grading_fields():
    full = {
        "question": "Q?",
        "options": ["A", "B", "C", "D"],
        "correct_index": 2,
        "explanation": "Because C.",
        "hint": "Think C.",
        "source_quote": "Quote.",
    }
    assert public_mcq(full) == {"question": "Q?", "options": ["A", "B", "C", "D"]}


def test_split_mcq_separates_public_and_key():
    full = {
        "question": "Q?",
        "options": ["A", "B", "C", "D"],
        "correct_index": 1,
        "explanation": "Exp.",
        "hint": "Hint.",
        "source_quote": "Quote.",
    }
    public, key = split_mcq(full)
    assert public == {"question": "Q?", "options": ["A", "B", "C", "D"]}
    assert key == {
        "correct_index": 1,
        "explanation": "Exp.",
        "hint": "Hint.",
        "source_quote": "Quote.",
    }
