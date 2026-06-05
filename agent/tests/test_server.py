"""Smoke tests for FastAPI endpoints. LLM calls are mocked."""
import fitz
from unittest.mock import patch
from fastapi.testclient import TestClient
from agent.server import app
from agent.plan_schema import LessonPlan, LearningObjective


def _pdf_bytes(text: str | None = None) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    if text:
        page.insert_text((50, 100), text)
    return doc.tobytes()


def test_health_endpoint_returns_ok():
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_copilotkit_endpoint_registered():
    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.post("/", json={})
    assert resp.status_code != 404


def test_extract_returns_text_for_valid_pdf():
    with TestClient(app) as client:
        resp = client.post(
            "/extract",
            files={"file": ("test.pdf", _pdf_bytes("Hello World"), "application/pdf")},
        )
    assert resp.status_code == 200
    assert "Hello World" in resp.json()["text"]


def test_extract_returns_422_for_blank_pdf():
    with TestClient(app) as client:
        resp = client.post(
            "/extract",
            files={"file": ("blank.pdf", _pdf_bytes(), "application/pdf")},
        )
    assert resp.status_code == 422
    assert "no extractable text" in resp.json()["detail"].lower()
