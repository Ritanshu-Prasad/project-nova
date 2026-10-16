import asyncio
import json

import httpx
import pytest
from fastapi import HTTPException

import llm
import prompts
import usage
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


def test_parse_json_skips_reasoning_that_contains_braces():
    text = 'I should answer with {"like": "this"} maybe.\nFinal: {"title": "Real", "items": [{"a": 1}, {"b": 2}]}'
    assert llm._parse_json(text) == {"title": "Real", "items": [{"a": 1}, {"b": 2}]}


def test_parse_json_takes_the_largest_object():
    assert llm._parse_json('{"small": 1} {"big": {"nested": [1, 2, 3]}, "more": true}') == {"big": {"nested": [1, 2, 3]}, "more": True}


def test_parse_json_keeps_braces_inside_strings():
    assert llm._parse_json('{"code": "if (x) { y(); }"}') == {"code": "if (x) { y(); }"}


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


# --- Token limits ---

def test_the_token_limit_is_sent_to_the_model(api):
    sent = []

    def handler(request):
        sent.append(json.loads(request.content)["max_tokens"])
        return reply()

    api(handler)
    run(llm.chat_json("s", "u", max_tokens=1234))
    run(llm.chat_json("s", "u"))
    assert sent == [1234, llm.DEFAULT_MAX_TOKENS]


def sent_bodies(api):
    bodies = []
    api(lambda request: bodies.append(json.loads(request.content)) or reply())
    return bodies


def test_the_model_answers_without_thinking_by_default(api):
    bodies = sent_bodies(api)
    run(llm.chat_json("s", "u"))
    assert bodies[0]["chat_template_kwargs"] == {"enable_thinking": False}


def test_thinking_can_be_allowed_for_a_request(api):
    bodies = sent_bodies(api)
    run(llm.chat_json("s", "u", thinking=True))
    assert "chat_template_kwargs" not in bodies[0]


def test_thinking_can_be_allowed_everywhere(api, monkeypatch):
    monkeypatch.setenv("NOVA_THINKING", "on")
    bodies = sent_bodies(api)
    run(llm.chat_json("s", "u"))
    assert "chat_template_kwargs" not in bodies[0]


# --- JSON schema ---

@pytest.fixture(autouse=True)
def schema_supported(monkeypatch):
    monkeypatch.setattr(llm, "_schema_supported", [True])
    monkeypatch.delenv("NOVA_JSON_SCHEMA", raising=False)


def test_a_schema_is_sent_as_the_response_format(api):
    bodies = []
    api(lambda request: bodies.append(json.loads(request.content)) or reply())
    run(llm.chat_json("s", "u", schema=QuestionList))
    sent = bodies[0]["response_format"]
    assert sent["type"] == "json_schema" and sent["json_schema"]["name"] == "questionlist"
    assert sent["json_schema"]["schema"] == QuestionList.model_json_schema()


def test_without_a_schema_plain_json_is_requested(api):
    bodies = []
    api(lambda request: bodies.append(json.loads(request.content)) or reply())
    run(llm.chat_json("s", "u"))
    assert bodies[0]["response_format"] == {"type": "json_object"}


def test_ask_sends_the_schema_of_the_answer_it_expects(api):
    bodies = []
    api(lambda request: bodies.append(json.loads(request.content)) or reply(content=json.dumps({"questions": questions(8)})))
    run(llm.ask(QuestionList, "s", "u"))
    assert bodies[0]["response_format"]["json_schema"]["name"] == "questionlist"


def test_an_endpoint_that_rejects_the_schema_is_asked_again_without_it(api):
    bodies = []

    def handler(request):
        body = json.loads(request.content)
        bodies.append(body)
        return httpx.Response(400, text="unsupported schema") if body["response_format"]["type"] == "json_schema" else reply()

    api(handler)
    assert run(llm.chat_json("s", "u", schema=QuestionList)) == {"ok": True}
    assert [b["response_format"]["type"] for b in bodies] == ["json_schema", "json_object"]


def test_after_a_rejection_schemas_are_not_tried_again(api):
    def handler(request):
        return httpx.Response(400) if json.loads(request.content)["response_format"]["type"] == "json_schema" else reply()

    api(handler)
    run(llm.chat_json("s", "u", schema=QuestionList))
    bodies = []
    api(lambda request: bodies.append(json.loads(request.content)) or reply())
    run(llm.chat_json("s", "u", schema=QuestionList))
    assert bodies[0]["response_format"]["type"] == "json_object"


def test_a_400_without_a_schema_is_an_error(api):
    api(lambda request: httpx.Response(400))
    with pytest.raises(HTTPException) as error:
        run(llm.chat_json("s", "u"))
    assert error.value.status_code == 502


def test_schemas_can_be_switched_off(api, monkeypatch):
    monkeypatch.setenv("NOVA_JSON_SCHEMA", "off")
    bodies = []
    api(lambda request: bodies.append(json.loads(request.content)) or reply())
    run(llm.chat_json("s", "u", schema=QuestionList))
    assert bodies[0]["response_format"] == {"type": "json_object"}


# --- Usage ---

def test_every_call_reports_its_tokens_and_kind(api, monkeypatch):
    seen = []

    async def record(kind, tokens_used, seconds):
        seen.append((kind, tokens_used))

    monkeypatch.setattr(usage, "record_call", record)
    api(lambda request: httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}], "usage": {"total_tokens": 321}}))
    run(llm.chat_json("s", "u", kind="lesson"))
    assert seen == [("lesson", {"total_tokens": 321})]


def test_retries_are_counted_for_the_request(api, monkeypatch):
    monkeypatch.setattr(llm, "RETRY_DELAYS", (0,))
    usage.begin()
    answers = iter([httpx.Response(429), reply()])
    api(lambda request: next(answers))
    run(llm.chat_json("s", "u"))
    assert usage.current().retries == 1 and usage.current().calls == 1


def test_unusable_answers_are_counted_as_retries(fake_model):
    usage.begin()
    fake_model.replies = [{"questions": questions(2)}, {"questions": questions(8)}]
    run(llm.ask(QuestionList, "s", "u"))
    assert usage.current().retries == 1


def test_ask_passes_its_kind_on(fake_model):
    run(llm.ask(QuestionList, prompts.questions_system("beginner", 8, False), "u", kind="quiz"))
    assert fake_model.kinds == ["quiz"] and fake_model.schemas == [QuestionList]
