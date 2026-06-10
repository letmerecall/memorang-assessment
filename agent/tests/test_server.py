"""Smoke tests for FastAPI endpoints. LLM calls are mocked."""
import os
from unittest.mock import AsyncMock, patch

import fitz
from fastapi.testclient import TestClient
from agent.server import MAX_PDF_BYTES, app


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


def test_extract_returns_413_for_oversized_pdf():
    with TestClient(app) as client:
        resp = client.post(
            "/extract",
            files={
                "file": (
                    "big.pdf",
                    b"x" * (MAX_PDF_BYTES + 1),
                    "application/pdf",
                )
            },
        )
    assert resp.status_code == 413
    assert "10 MB" in resp.json()["detail"]


def test_lifespan_wires_postgres_checkpointer_when_database_url_set():
    mock_pool = AsyncMock()
    mock_checkpointer = AsyncMock()
    with patch.dict(os.environ, {"DATABASE_URL": "postgresql://u:p@localhost/db"}, clear=False):
        with patch("agent.server.build_graph") as mock_build, patch(
            "psycopg_pool.AsyncConnectionPool",
            return_value=mock_pool,
        ), patch(
            "langgraph.checkpoint.postgres.aio.AsyncPostgresSaver",
            return_value=mock_checkpointer,
        ):
            with TestClient(app) as client:
                resp = client.get("/health")
    assert resp.status_code == 200
    mock_pool.open.assert_awaited_once()
    mock_checkpointer.setup.assert_awaited_once()
    mock_pool.close.assert_awaited_once()
    mock_build.assert_called_once_with(checkpointer=mock_checkpointer)


def test_state_endpoint_returns_public_state_only():
    import asyncio

    with TestClient(app) as client:
        graph = app.state.graph
        config = {"configurable": {"thread_id": "state-test-thread"}}
        asyncio.run(
            graph.aupdate_state(
                config,
                {
                    "lesson_plan": {"objectives": [{"title": "O1"}]},
                    "current_idx": 1,
                    "current_mcq": {"question": "Q?", "options": ["a", "b", "c", "d"]},
                    "pdf_text": "private pdf text",
                    "mcq_key": {"correct_index": 2},
                    "mcq_queue": [{"mcq_key": {"correct_index": 0}}],
                },
                as_node="ask_mcq",
            )
        )
        resp = client.get("/state/state-test-thread")

    assert resp.status_code == 200
    data = resp.json()
    assert data["lesson_plan"] == {"objectives": [{"title": "O1"}]}
    assert data["current_idx"] == 1
    assert data["current_mcq"]["question"] == "Q?"
    # Never leak answer keys or raw PDF text to the client.
    assert "mcq_key" not in data
    assert "mcq_queue" not in data
    assert "pdf_text" not in data


def test_state_endpoint_returns_404_for_unknown_thread():
    with TestClient(app) as client:
        resp = client.get("/state/no-such-thread")
    assert resp.status_code == 404
