"""
Smoke tests for the FastAPI server endpoints.
The CopilotKit / ag-ui endpoint is verified as registered after lifespan startup.
End-to-end agent execution requires a running DB — not tested here.
"""
from fastapi.testclient import TestClient
from agent.server import app


def test_health_endpoint_registered():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200


def test_copilotkit_endpoint_registered():
    """POST / must not 404 after lifespan registers the AG-UI route."""
    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.post("/", json={})
        assert resp.status_code != 404
