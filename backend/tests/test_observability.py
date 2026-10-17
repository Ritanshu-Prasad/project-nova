import json
import logging
import re

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import accounts
import capture
import llm
import observability
import usage


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


# --- Models and the startup line ---

def test_health_names_the_models_in_use(client, monkeypatch):
    monkeypatch.delenv("NOVA_GENERATE_MODEL", raising=False)
    monkeypatch.delenv("NOVA_TUTOR_MODEL", raising=False)
    models = client.get("/api/health").json()["models"]
    assert models == {"generate": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", "tutor": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", "refused_settings": []}


def test_health_shows_a_refused_model_setting(client, monkeypatch):
    monkeypatch.setenv("NOVA_GENERATE_MODEL", "nvidia/Nemotron-3-Ultra-550b-a55b")
    models = client.get("/api/health").json()["models"]
    assert models["generate"].endswith("Nano-30B-A3B") and models["refused_settings"] == ["NOVA_GENERATE_MODEL"]


def startup_lines(caplog) -> list:
    with caplog.at_level(logging.INFO, logger="nova.requests"):
        observability.log_startup()
    return [record.getMessage() for record in caplog.records]


def test_the_startup_line_lists_models_and_features(caplog, monkeypatch):
    monkeypatch.delenv("NOVA_GENERATE_MODEL", raising=False)
    monkeypatch.setenv("NOVA_CACHE", "off")
    line = startup_lines(caplog)[0]
    assert "generate=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B" in line and "cache=False" in line and "store=memory" in line
    assert "json_schema=True" in line and "daily_token_budget=none" in line


def test_the_startup_line_shows_the_price_in_use(caplog, monkeypatch):
    monkeypatch.setenv("NOVA_PRICE_INPUT_PER_M", "0.1")
    assert "price_per_million_in_out=0.1/0.24" in startup_lines(caplog)[0]


def test_the_startup_line_shows_the_budget(caplog, monkeypatch):
    monkeypatch.setenv("NOVA_DAILY_TOKEN_BUDGET", "1000")
    assert "daily_token_budget=1000" in startup_lines(caplog)[0]


def test_a_refused_model_setting_is_reported_at_startup(caplog, monkeypatch):
    monkeypatch.setattr(llm, "_warned_settings", set())
    monkeypatch.setenv("NOVA_TUTOR_MODEL", "nvidia/Nemotron-3-Ultra-550b-a55b")
    with caplog.at_level(logging.ERROR):
        observability.log_startup()
    assert any("NOVA_TUTOR_MODEL" in record.getMessage() and "not an allowed model" in record.getMessage() for record in caplog.records)


# --- JSON logs ---

def record(message="hello", **extra) -> logging.LogRecord:
    made = logging.LogRecord("nova.test", logging.INFO, __file__, 1, message, None, None)
    made.request_id = "abc123"
    for name, value in extra.items():
        setattr(made, name, value)
    return made


def test_a_json_log_line_is_one_parseable_object():
    line = json.loads(observability.JsonFormatter().format(record("GET /x -> 200")))
    assert line["message"] == "GET /x -> 200" and line["level"] == "INFO" and line["logger"] == "nova.test" and line["request_id"] == "abc123"
    assert re.match(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$", line["time"])


def test_the_cost_of_a_request_rides_along_as_data():
    line = json.loads(observability.JsonFormatter().format(record(usage={"calls": 5, "cost_usd": 0.0008})))
    assert line["usage"] == {"calls": 5, "cost_usd": 0.0008}


def test_a_line_without_usage_has_no_usage_field():
    assert "usage" not in json.loads(observability.JsonFormatter().format(record()))


def test_non_ascii_text_is_kept_readable():
    assert "Écran" in observability.JsonFormatter().format(record("Écran"))


def test_json_logging_is_chosen_by_the_environment(monkeypatch):
    monkeypatch.setenv("LOG_FORMAT", "json")
    root = logging.getLogger()
    saved = list(root.handlers)
    handler = logging.StreamHandler()
    root.handlers = [handler]
    try:
        observability.configure_logging()
        assert isinstance(handler.formatter, observability.JsonFormatter)
    finally:
        root.handlers = saved


def test_a_request_that_used_the_model_logs_its_usage_as_data(caplog):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()
    observability.add_request_logging(app)

    @app.get("/work")
    async def work():
        await usage.record_call("lesson", "m", {"prompt_tokens": 100, "completion_tokens": 20}, 1.0)
        return "ok"

    with caplog.at_level(logging.INFO, logger="nova.requests"):
        TestClient(app).get("/work")
    last = caplog.records[-1]
    assert last.usage["calls"] == 1 and last.usage["prompt_tokens"] == 100 and "calls=1 tokens=120" in last.getMessage()


def test_a_request_without_model_calls_has_no_usage_data(client, caplog):
    with caplog.at_level(logging.INFO, logger="nova.requests"):
        client.get("/ping")
    assert not hasattr(caplog.records[-1], "usage")


def test_usage_is_available_as_plain_data():
    spent = usage.begin()
    import asyncio

    asyncio.run(usage.record_call("lesson", "m", {"prompt_tokens": 100, "completion_tokens": 20}, 1.0))
    assert spent.as_dict() == {"calls": 1, "prompt_tokens": 100, "completion_tokens": 20, "cost_usd": round(spent.cost_usd, 6), "retries": 0, "failures": 0}


# --- Saving prompts for debugging ---

@pytest.fixture
def prompt_file(tmp_path, monkeypatch):
    monkeypatch.setattr(capture, "FILE", tmp_path / "prompts.jsonl")
    monkeypatch.delenv("VERCEL", raising=False)
    return tmp_path / "prompts.jsonl"


def test_nothing_is_saved_unless_asked(prompt_file):
    capture.save_exchange("lesson", "s", "u", "r", None)
    assert not prompt_file.exists()


def test_an_exchange_is_saved_when_asked(prompt_file, monkeypatch):
    monkeypatch.setenv("NOVA_LOG_PROMPTS", "on")
    token = observability.request_id_var.set("req-1")
    try:
        capture.save_exchange("lesson", "system text", "user text", "reply text", {"total_tokens": 9})
    finally:
        observability.request_id_var.reset(token)
    saved = json.loads(prompt_file.read_text())
    assert (saved["kind"], saved["request_id"], saved["system"], saved["user"], saved["reply"], saved["tokens"]) == ("lesson", "req-1", "system text", "user text", "reply text", {"total_tokens": 9})


def test_long_prompts_are_cut(prompt_file, monkeypatch):
    monkeypatch.setenv("NOVA_LOG_PROMPTS", "on")
    capture.save_exchange("lesson", "s" * 5000, "u", "r", None)
    assert len(json.loads(prompt_file.read_text())["system"]) == capture.MAX_CHARS


def test_each_exchange_is_a_line(prompt_file, monkeypatch):
    monkeypatch.setenv("NOVA_LOG_PROMPTS", "on")
    capture.save_exchange("lesson", "s", "u", "r", None), capture.save_exchange("quiz", "s", "u", "r", None)
    assert [json.loads(line)["kind"] for line in prompt_file.read_text().splitlines()] == ["lesson", "quiz"]


def test_prompts_are_never_saved_on_a_hosted_deployment(prompt_file, monkeypatch):
    monkeypatch.setenv("NOVA_LOG_PROMPTS", "on")
    monkeypatch.setenv("VERCEL", "1")
    capture.save_exchange("lesson", "s", "u", "r", None)
    assert not prompt_file.exists()


def test_a_file_that_cannot_be_written_does_not_stop_the_request(tmp_path, monkeypatch):
    monkeypatch.setenv("NOVA_LOG_PROMPTS", "on")
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setattr(capture, "FILE", tmp_path)
    capture.save_exchange("lesson", "s", "u", "r", None)
