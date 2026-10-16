import logging

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import accounts
import observability


@pytest.fixture
def client():
    app = FastAPI()
    observability.add_request_logging(app)
    app.include_router(observability.router)

    @app.get("/ping")
    def ping():
        return "pong"

    @app.get("/boom")
    def boom():
        raise RuntimeError("unexpected")

    @app.get("/missing")
    def missing():
        raise HTTPException(404, "nope")

    return TestClient(app, raise_server_exceptions=False)


# --- Request logging ---

def test_every_response_carries_a_request_id_and_timing(client):
    response = client.get("/ping")
    assert len(response.headers["x-request-id"]) == 12
    assert response.headers["x-response-time"].endswith("ms")


def test_a_valid_incoming_request_id_is_kept(client):
    assert client.get("/ping", headers={"x-request-id": "trace-123"}).headers["x-request-id"] == "trace-123"


@pytest.mark.parametrize("bad", ["has space", "x" * 100, "semi;colon", "new\tline"])
def test_an_invalid_incoming_request_id_is_replaced(client, bad):
    assert client.get("/ping", headers={"x-request-id": bad}).headers["x-request-id"] != bad


def test_each_request_gets_its_own_id(client):
    assert client.get("/ping").headers["x-request-id"] != client.get("/ping").headers["x-request-id"]


def test_requests_are_logged_with_method_path_status_and_duration(client, caplog):
    with caplog.at_level(logging.INFO, logger="nova.requests"):
        client.get("/missing")
    assert any(record.getMessage().startswith("GET /missing -> 404 (") and "ms)" in record.getMessage() for record in caplog.records)


def test_a_crash_is_logged_and_still_answered_with_500(client, caplog):
    with caplog.at_level(logging.ERROR, logger="nova.requests"):
        response = client.get("/boom")
    assert response.status_code == 500
    assert any("GET /boom -> failed" in record.getMessage() for record in caplog.records)


def test_log_lines_include_the_request_id():
    record = logging.LogRecord("nova.test", logging.INFO, __file__, 1, "message", None, None)
    token = observability.request_id_var.set("abc123")
    try:
        observability.RequestIdFilter().filter(record)
    finally:
        observability.request_id_var.reset(token)
    assert record.request_id == "abc123"


# --- Health ---

def test_health_reports_status_uptime_and_services(client, monkeypatch):
    monkeypatch.setenv("NEBIUS_API_KEY", "key")
    body = client.get("/api/health").json()
    assert body["status"] == "healthy" and body["uptime_seconds"] >= 0 and body["timestamp"] > 0
    assert body["services"]["nebius_ai"] == "configured"


def test_health_says_when_the_model_key_is_missing(client, monkeypatch):
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    assert client.get("/api/health").json()["services"]["nebius_ai"] == "missing key"


def test_health_reports_local_storage(client, monkeypatch, tmp_path):
    monkeypatch.setattr(accounts, "store", accounts.FileStore(tmp_path / "accounts.json"))
    services = client.get("/api/health").json()["services"]
    assert (services["storage_mode"], services["storage"]) == ("local", "connected")


def test_health_reports_missing_storage(client, monkeypatch):
    monkeypatch.setattr(accounts, "store", None)
    body = client.get("/api/health").json()
    assert body["services"]["storage"] == "not configured" and body["status"] == "healthy"


def test_health_checks_that_redis_answers(client, monkeypatch):
    class Redis(accounts.RedisStore):
        async def get(self, key):
            return None

    monkeypatch.setattr(accounts, "store", Redis("https://redis.test", "token"))
    services = client.get("/api/health").json()["services"]
    assert (services["storage_mode"], services["storage"]) == ("redis", "connected")


def test_health_is_degraded_when_redis_is_unreachable(client, monkeypatch):
    class Redis(accounts.RedisStore):
        async def get(self, key):
            raise HTTPException(502, "down")

    monkeypatch.setattr(accounts, "store", Redis("https://redis.test", "token"))
    body = client.get("/api/health").json()
    assert body["status"] == "degraded" and body["services"]["storage"] == "unreachable"
