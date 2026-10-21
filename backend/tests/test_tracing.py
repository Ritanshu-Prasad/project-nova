import asyncio
import logging

import pytest

import llm
import tracing
from request_context import request_id_var

KEYS = {"LANGFUSE_PUBLIC_KEY": "pk", "LANGFUSE_SECRET_KEY": "sk", "LANGFUSE_HOST": "https://langfuse.example"}


class FakeObservation:
    def __init__(self, fake, kwargs):
        self.kwargs, self.ended = kwargs, False
        fake.observations.append(self)

    def end(self):
        self.ended = True


class FakeLangfuse:
    def __init__(self):
        self.observations, self.scores, self.flushes = [], [], 0

    def create_trace_id(self, seed=None):
        return f"trace-{seed}" if seed else "trace-random"

    def start_observation(self, **kwargs):
        return FakeObservation(self, kwargs)

    def create_score(self, **kwargs):
        self.scores.append(kwargs)

    def flush(self):
        self.flushes += 1


@pytest.fixture
def langfuse(monkeypatch):
    for name, value in KEYS.items():
        monkeypatch.setenv(name, value)
    monkeypatch.delenv("NOVA_TRACE_CONTENT", raising=False)
    fake = FakeLangfuse()
    monkeypatch.setattr(tracing, "_client", fake)
    return fake


@pytest.fixture(autouse=True)
def reset(monkeypatch):
    monkeypatch.setattr(tracing, "_client", None)
    token = request_id_var.set("req123")
    yield
    request_id_var.reset(token)


def record(**changes):
    values = dict(kind="lesson", model="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B", system="SYS", user="USER typed by a learner", reply="REPLY", tokens={"prompt_tokens": 1000, "completion_tokens": 500}, seconds=2.345)
    tracing.record_generation(**{**values, **changes})


# --- Off by default ---

def test_tracing_is_off_without_the_three_settings(monkeypatch):
    for name in KEYS:
        monkeypatch.delenv(name, raising=False)
    assert not tracing.enabled() and tracing.client() is None
    record(), tracing.record_failure("lesson", "m"), tracing.score("x", 1), tracing.flush()


@pytest.mark.parametrize("missing", list(KEYS))
def test_one_missing_setting_keeps_it_off(monkeypatch, missing):
    for name, value in KEYS.items():
        monkeypatch.setenv(name, value)
    monkeypatch.delenv(missing)
    assert not tracing.enabled()


# --- What is sent ---

def test_a_model_call_becomes_one_generation_with_tokens_cost_and_time(langfuse):
    record()
    (observation,) = langfuse.observations
    sent = observation.kwargs
    assert observation.ended and sent["as_type"] == "generation" and sent["name"] == "lesson" and sent["model"].endswith("Nano-30B-A3B")
    assert sent["usage_details"] == {"input": 1000, "output": 500} and sent["cost_details"]["total"] == pytest.approx(0.00018)
    assert sent["metadata"] == {"seconds": 2.35}


def test_the_request_id_is_the_trace_id(langfuse):
    record()
    assert langfuse.observations[0].kwargs["trace_context"] == {"trace_id": "trace-req123"}


def test_without_a_request_the_trace_gets_a_random_id(langfuse):
    request_id_var.set("-")
    record()
    assert langfuse.observations[0].kwargs["trace_context"] == {"trace_id": "trace-random"}


def test_prompts_and_replies_are_not_sent_unless_asked_for(langfuse):
    record()
    sent = langfuse.observations[0].kwargs
    assert sent["input"] is None and sent["output"] is None
    assert "learner" not in str(sent)


def test_content_is_sent_when_the_switch_is_on(langfuse, monkeypatch):
    monkeypatch.setenv("NOVA_TRACE_CONTENT", "on")
    record()
    sent = langfuse.observations[0].kwargs
    assert sent["output"] == "REPLY" and sent["input"][1] == {"role": "user", "content": "USER typed by a learner"}


def test_a_call_without_usage_is_recorded_with_zero_tokens(langfuse):
    record(tokens=None)
    assert langfuse.observations[0].kwargs["usage_details"] == {"input": 0, "output": 0}


def test_a_failed_call_is_shown_as_an_error(langfuse):
    tracing.record_failure("lesson", "m")
    sent = langfuse.observations[0].kwargs
    assert sent["level"] == "ERROR" and sent["name"] == "lesson"


def test_scores_go_to_the_request_trace(langfuse):
    tracing.score("bank_problems", 2, "evidence")
    assert langfuse.scores == [{"name": "bank_problems", "value": 2, "trace_id": "trace-req123", "data_type": "NUMERIC", "comment": "evidence"}]


def test_flush_sends_what_is_waiting(langfuse):
    tracing.flush()
    assert langfuse.flushes == 1


# --- It never hurts a request ---

def test_a_broken_client_does_not_raise(langfuse, caplog):
    def broken(**_):
        raise RuntimeError("langfuse down")

    langfuse.start_observation = broken
    langfuse.create_score = broken
    langfuse.flush = lambda: broken()
    with caplog.at_level(logging.WARNING):
        record(), tracing.record_failure("lesson", "m"), tracing.score("x", 1), tracing.flush()
    assert caplog.text.count("langfuse down") == 4


# --- From the real call path ---

def test_a_real_model_call_is_traced_once_with_the_reply_text_hidden(langfuse, monkeypatch):
    class Response:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": '{"a": 1}'}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 40, "completion_tokens": 10}}

    async def post(payload, key, kind):
        return Response()

    monkeypatch.setenv("NEBIUS_API_KEY", "k")
    monkeypatch.setattr(llm, "_post", post)
    assert asyncio.run(llm.chat_json("system", "user", kind="quiz")) == {"a": 1}
    (observation,) = langfuse.observations
    assert observation.kwargs["name"] == "quiz" and observation.kwargs["usage_details"] == {"input": 40, "output": 10} and observation.kwargs["output"] is None


def test_a_gave_up_call_is_traced_as_an_error(langfuse):
    import usage

    asyncio.run(usage.record_failure("lesson", "m"))
    assert langfuse.observations[0].kwargs["level"] == "ERROR"


def test_a_slow_flush_does_not_hold_a_request_for_long(langfuse, monkeypatch):
    import time

    monkeypatch.setattr(langfuse, "flush", lambda: time.sleep(0.5))

    async def waited() -> float:
        started = time.perf_counter()
        await tracing.flush_within(0.05)
        return time.perf_counter() - started

    assert asyncio.run(waited()) < 0.4


def test_a_request_that_called_the_model_flushes_its_traces(langfuse):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    import observability
    import usage

    app = FastAPI()
    observability.add_request_logging(app)

    @app.get("/model")
    async def model():
        await usage.record_call("lesson", "m", {"prompt_tokens": 1, "completion_tokens": 1}, 0.1)
        return "ok"

    @app.get("/plain")
    async def plain():
        return "ok"

    client = TestClient(app)
    client.get("/plain")
    assert langfuse.flushes == 0
    client.get("/model")
    assert langfuse.flushes == 1
