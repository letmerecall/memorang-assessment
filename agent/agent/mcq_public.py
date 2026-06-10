"""Helpers to separate client-safe MCQ display data from grading secrets."""


def public_mcq(mcq: dict | None) -> dict | None:
    """Return only question and options for client-facing payloads."""
    if mcq is None:
        return None
    return {"question": mcq["question"], "options": mcq["options"]}


def split_mcq(full: dict) -> tuple[dict, dict]:
    """Split a full MCQ dict into public display data and server-only grading key."""
    public = {"question": full["question"], "options": full["options"]}
    key = {
        "correct_index": full["correct_index"],
        "explanation": full["explanation"],
        "hint": full["hint"],
        "source_quote": full["source_quote"],
    }
    return public, key
