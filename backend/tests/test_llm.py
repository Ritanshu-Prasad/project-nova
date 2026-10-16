import asyncio
import json

import httpx
import pytest
from fastapi import HTTPException

import llm


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
    llm._raise_for_upstream(httpx.Response(200))


def test_rate_limit_becomes_503():
    with pytest.raises(HTTPException) as error:
        llm._raise_for_upstream(httpx.Response(429))
    assert error.value.status_code == 503


def test_other_errors_become_502():
    with pytest.raises(HTTPException) as error:
        llm._raise_for_upstream(httpx.Response(500))
    assert error.value.status_code == 502


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
