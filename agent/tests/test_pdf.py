"""Tests for PDF text extraction — no LLM calls."""
import pytest
import fitz  # PyMuPDF
from agent.pdf import extract_text, trim_to_budget, NoExtractableTextError


def _make_pdf(text: str | None = None) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    if text:
        page.insert_text((50, 100), text)
    return doc.tobytes()


def test_extract_text_returns_content_from_valid_pdf():
    pdf_bytes = _make_pdf("Hello World")
    result = extract_text(pdf_bytes)
    assert "Hello World" in result


def test_extract_text_raises_for_blank_page():
    pdf_bytes = _make_pdf()  # no text inserted
    with pytest.raises(NoExtractableTextError, match="no extractable text"):
        extract_text(pdf_bytes)


def test_extract_text_raises_for_non_pdf_bytes():
    with pytest.raises(NoExtractableTextError, match="could not open file as PDF"):
        extract_text(b"this is not a pdf")


def test_trim_to_budget_truncates_long_text():
    long_text = "a" * 100_000
    result = trim_to_budget(long_text, max_chars=80_000)
    assert len(result) == 80_000


def test_trim_to_budget_leaves_short_text_unchanged():
    short_text = "hello world"
    result = trim_to_budget(short_text, max_chars=80_000)
    assert result == short_text


def test_trim_to_budget_uses_80k_default():
    long_text = "x" * 100_000
    result = trim_to_budget(long_text)
    assert len(result) == 80_000
