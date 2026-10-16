import asyncio
import json

import httpx
import pytest
from fastapi import HTTPException

import llm
from course_models import QuestionList
from samples import questions


def run(coro):
    return asyncio.run(coro)


def reply(status: int = 200, content: str = '{"ok": true}') -> httpx.Response:
    return httpx.Response(status, json={"choices": [{"message": {"content": content}, "finish_reason": "stop"}]})


@pytest.fixture
def api(monkeypatch):
    """Routes the client's requests to a handler instead of the network."""
    monkeypatch.setenv("NEBIUS_API_KEY", "test-key")
    monkeypatch.setenv("NEBIUS_BASE_URL", "https://example.test/v1/")
    monkeypatch.setenv("NOVA_GENERATE_MODEL", "test-model")
    real_client = httpx.AsyncClient

    def install(handler):
        monkeypatch.setattr(llm.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))

    return install


# --- Reading the model's text ---

def test_parse_json_reads_plain_json():
    assert llm._parse_json('{"a": 1}') == {"a": 1}


def test_parse_json_ignores_text_around_the_object():
    assert llm._parse_json('Here you go:\n```json\n{"a": 1}\n```') == {"a": 1}


@pytest.mark.parametrize("text", ["", "no json here", "{broken", "[1, 2]"])
def test_parse_json_rejects_anything_else(text):
    with pytest.raises(ValueError):
        llm._parse_json(text)


# --- Upstream errors ---

def test_success_response_passes():
    llm.raise_for_upstream(httpx.Response(200))


def test_rate_limit_becomes_503():
    with pytest.raises(HTTPException) as error:
        llm.raise_for_upstream(httpx.Response(429))
    assert error.value.status_code == 503


def test_other_errors_become_502():
    with pytest.raises(HTTPException) as error:
        llm.raise_for_upstream(httpx.Response(500))
    assert error.value.status_code == 502


# --- Settings ---

def test_defaults_point_at_nebius_and_the_nano_model(monkeypatch):
    for name in ("NEBIUS_BASE_URL", "NOVA_GENERATE_MODEL", "NOVA_TUTOR_MODEL"):
        monkeypatch.delenv(name, raising=False)
    assert llm.base_url() == "https://api.tokenfactory.nebius.com/v1"
    assert llm.generate_model() == llm.tutor_model() == "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"


def test_settings_follow_the_environment(monkeypatch):
    monkeypatch.setenv("NEBIUS_BASE_URL", "https://other.test/v1/")
    monkeypatch.setenv("NOVA_GENERATE_MODEL", "gen/model")
    monkeypatch.setenv("NOVA_TUTOR_MODEL", "tutor/model")
    assert (llm.base_url(), llm.generate_model(), llm.tutor_model()) == ("https://other.test/v1", "gen/model", "tutor/model")


# --- chat_json ---

def test_missing_key_is_503(monkeypatch):
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    with pytest.raises(HTTPException) as error:
        run(llm.chat_json("system", "user"))
    assert error.value.status_code == 503


def test_chat_json_sends_the_model_and_key_and_returns_the_object(api):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return reply(content='{"answer": 42}')

    api(handler)
    assert run(llm.chat_json("be brief", "question")) == {"answer": 42}
    assert seen["url"] == "https://example.test/v1/chat/completions"
    assert seen["auth"] == "Bearer test-key"
    assert seen["body"]["model"] == "test-model"
    assert seen["body"]["messages"][0] == {"role": "system", "content": "be brief"}


def test_timeout_becomes_503(api):
    def handler(request):
        raise httpx.ReadTimeout("slow")

    api(handler)
    with pytest.raises(HTTPException) as error:
        run(llm.chat_json("s", "u"))
    assert error.value.status_code == 503


def test_connection_failure_becomes_502(api):
    def handler(request):
        raise httpx.ConnectError("down")

    api(handler)
    with pytest.raises(HTTPException) as error:
        run(llm.chat_json("s", "u"))
    assert error.value.status_code == 502


def test_unparseable_content_raises_value_error(api):
    api(lambda request: reply(content="not json at all"))
    with pytest.raises(ValueError):
        run(llm.chat_json("s", "u"))


# --- Retries and the shared gate ---

def test_a_rate_limited_request_is_retried_and_then_succeeds(api, monkeypatch):
    monkeypatch.setattr(llm, "RETRY_DELAYS", (0, 0))
    answers = iter([httpx.Response(429), httpx.Response(503), reply(content='{"ok": 1}')])
    api(lambda request: next(answers))
    assert run(llm.chat_json("s", "u")) == {"ok": 1}


def test_retries_stop_after_the_last_delay(api, monkeypatch):
    monkeypatch.setattr(llm, "RETRY_DELAYS", (0, 0))
    calls = []
    api(lambda request: calls.append(1) or httpx.Response(429))
    with pytest.raises(HTTPException) as error:
        run(llm.chat_json("s", "u"))
    assert len(calls) == 3 and error.value.status_code == 503


def test_a_timeout_is_retried(api, monkeypatch):
    monkeypatch.setattr(llm, "RETRY_DELAYS", (0,))
    attempts = []

    def handler(request):
        attempts.append(1)
        if len(attempts) == 1:
            raise httpx.ReadTimeout("slow")
        return reply(content='{"ok": 2}')

    api(handler)
    assert run(llm.chat_json("s", "u")) == {"ok": 2}


def test_client_errors_are_not_retried(api, monkeypatch):
    monkeypatch.setattr(llm, "RETRY_DELAYS", (0, 0))
    calls = []
    api(lambda request: calls.append(1) or httpx.Response(400))
    with pytest.raises(HTTPException):
        run(llm.chat_json("s", "u"))
    assert len(calls) == 1


def test_only_a_limited_number_of_requests_run_at_once(api, monkeypatch):
    monkeypatch.setattr(llm, "MAX_PARALLEL_CALLS", 2)
    monkeypatch.setattr(llm, "_gates", {})
    running, peak = [0], [0]
    real_client = httpx.AsyncClient

    class SlowTransport(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request):
            running[0] += 1
            peak[0] = max(peak[0], running[0])
            await asyncio.sleep(0.01)
            running[0] -= 1
            return reply()

    monkeypatch.setattr(llm.httpx, "AsyncClient", lambda **kw: real_client(transport=SlowTransport(), **kw))

    async def many():
        await asyncio.gather(*(llm.chat_json("s", "u") for _ in range(6)))

    run(many())
    assert peak[0] == 2


# --- ask ---

def test_ask_returns_the_validated_answer(fake_model):
    fake_model.replies = [{"questions": questions(8)}]
    assert len(run(llm.ask(QuestionList, "system", "user")).questions) == 8


def test_ask_tries_again_after_an_unusable_answer(fake_model):
    fake_model.replies = [{"questions": questions(2)}, {"questions": questions(8)}]
    assert len(run(llm.ask(QuestionList, "system", "user")).questions) == 8
    assert len(fake_model.calls) == 2


def test_ask_gives_up_with_502(fake_model):
    fake_model.replies = [{"questions": []}] * llm.ATTEMPTS
    with pytest.raises(HTTPException) as error:
        run(llm.ask(QuestionList, "system", "user"))
    assert error.value.status_code == 502 and len(fake_model.calls) == llm.ATTEMPTS


def test_ask_does_not_hide_model_errors(fake_model):
    fake_model.replies = [HTTPException(503, "busy")]
    with pytest.raises(HTTPException) as error:
        run(llm.ask(QuestionList, "system", "user"))
    assert error.value.status_code == 503 and len(fake_model.calls) == 1
