import asyncio
import contextvars
import json
import logging
import os
import random
import time
from functools import lru_cache
from typing import Type, TypeVar

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

import capture
import usage
from models import DEEPSEEK_MODEL, LIGHTNING_MODEL, NANO_MODEL

logger = logging.getLogger("nova.llm")

DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1"
# What each part of the pipeline uses unless a setting says otherwise: Lightning writes everything, DeepSeek plans the course.
DEFAULT_MODEL = LIGHTNING_MODEL
DEFAULT_PLAN_MODEL = DEEPSEEK_MODEL
# Models that may be used without NOVA_ALLOWED_MODELS (all three are priced in pricing.py).
VETTED_MODELS = (NANO_MODEL, LIGHTNING_MODEL, DEEPSEEK_MODEL)
# Calls that plan a course (its modules and topics, and changes to the plan) use the planning model, quiz calls the question model.
PLAN_KINDS = frozenset({"outline", "module"})
BANK_KINDS = frozenset({"quiz", "placement"})
TIMEOUT = httpx.Timeout(120.0, connect=10.0)
ATTEMPTS = 3
DEFAULT_MAX_TOKENS = 5000
MAX_PARALLEL_CALLS = 16
RETRY_DELAYS = (1.0, 3.0)
RETRY_STATUSES = {429, 500, 502, 503, 504}
_gates: dict = {}
_schema_unsupported: set = set()
_forced_model: contextvars.ContextVar = contextvars.ContextVar("forced_model", default=None)
_warned_settings: set = set()

T = TypeVar("T", bound=BaseModel)


# --- Settings ---

def api_key() -> str | None:
    return os.getenv("NEBIUS_API_KEY")


def base_url() -> str:
    return os.getenv("NEBIUS_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def plan_model() -> str:
    """Plans the modules and topics of a course (and changes to the plan)."""
    return _allowed(os.getenv("NOVA_PLAN_MODEL", DEFAULT_PLAN_MODEL), "NOVA_PLAN_MODEL")


def _stage_model(specific: str) -> str:
    """The stage's own setting, else the older NOVA_GENERATE_MODEL, else the default."""
    if os.getenv(specific):
        return _allowed(os.getenv(specific, ""), specific)
    return _allowed(os.getenv("NOVA_GENERATE_MODEL", DEFAULT_MODEL), "NOVA_GENERATE_MODEL")


def content_model() -> str:
    """Writes the lessons, and answers the smaller questions of the pipeline (code check, answer check, safety, judging)."""
    return _stage_model("NOVA_CONTENT_MODEL")


def bank_model() -> str:
    """Writes the question banks and the placement quiz."""
    return _stage_model("NOVA_BANK_MODEL")


def generate_model() -> str:
    """The model that writes course content (kept for code that asks for the one course model)."""
    return content_model()


def tutor_model() -> str:
    return _allowed(os.getenv("NOVA_TUTOR_MODEL", DEFAULT_MODEL), "NOVA_TUTOR_MODEL")


def model_for(kind: str) -> str:
    """The model a call of this kind goes to (a call being retried on the fallback goes there)."""
    forced = _forced_model.get()
    if forced:
        return forced
    if kind in PLAN_KINDS:
        return plan_model()
    if kind in BANK_KINDS:
        return bank_model()
    return content_model()


def fallback_for(model: str) -> str | None:
    """Where a call goes when its model is down or keeps giving unusable answers: the content model, unless that was the one that failed."""
    fallback = content_model()
    return fallback if fallback != model else None


def models_in_use() -> dict:
    """The models requests really use, and which settings asked for a model that is not allowed."""
    used = {"plan": plan_model(), "content": content_model(), "bank": bank_model(), "tutor": tutor_model()}
    shown = {"NOVA_PLAN_MODEL": used["plan"], "NOVA_CONTENT_MODEL": used["content"], "NOVA_BANK_MODEL": used["bank"], "NOVA_GENERATE_MODEL": used["content"], "NOVA_TUTOR_MODEL": used["tutor"]}
    refused = [name for name, model in shown.items() if os.getenv(name) and os.getenv(name) != model]
    return {"generate": used["content"], **used, "refused_settings": refused}


def _allowed(configured: str, setting: str) -> str:
    """Only the vetted models are used unless NOVA_ALLOWED_MODELS names others on purpose, so a wrong setting cannot cost more."""
    allowed = {*VETTED_MODELS, *(name.strip() for name in os.getenv("NOVA_ALLOWED_MODELS", "").split(",") if name.strip())}
    if configured in allowed:
        return configured
    fallback = DEFAULT_PLAN_MODEL if setting == "NOVA_PLAN_MODEL" else DEFAULT_MODEL
    if setting not in _warned_settings:
        _warned_settings.add(setting)
        logger.error("%s=%s is not an allowed model, using %s instead (NOVA_ALLOWED_MODELS widens the list)", setting, configured, fallback)
    return fallback


# --- Requests ---


async def chat_json(system: str, user: str, max_tokens: int = DEFAULT_MAX_TOKENS, thinking: bool = False, schema: Type[BaseModel] | None = None, kind: str = "call") -> dict:
    """One chat completion that must come back as a JSON object, shaped by `schema` when the endpoint allows it."""
    key = api_key()
    if not key:
        raise HTTPException(503, "Course model is not configured")
    model = model_for(kind)
    try:
        return await _chat_json(model, key, system, user, max_tokens, thinking, schema, kind)
    except HTTPException:
        backup = None if _forced_model.get() else fallback_for(model)
        if backup is None:
            raise
        logger.warning("%s failed for %s, trying %s", model, kind, backup)
        usage.note(f"{kind}: {model} failed, asked {backup}")
        return await _chat_json(backup, key, system, user, max_tokens, thinking, schema, kind)


async def _chat_json(model: str, key: str, system: str, user: str, max_tokens: int, thinking: bool, schema: Type[BaseModel] | None, kind: str) -> dict:
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": _response_format(schema, model),
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }
    if not (thinking or os.getenv("NOVA_THINKING") == "on"):
        payload["chat_template_kwargs"] = {"enable_thinking": False}
    started = time.perf_counter()
    response = await _post(payload, key, kind)
    if response.status_code == 400 and payload["response_format"]["type"] == "json_schema":
        logger.warning("Endpoint rejected the JSON schema for %s, using plain JSON from now on: %.200s", kind, response.text)
        _schema_unsupported.add(model)
        response = await _post({**payload, "response_format": {"type": "json_object"}}, key, kind)
    await _raise_for_upstream(response, kind, payload["model"])
    body = response.json()
    await usage.record_call(kind, payload["model"], body.get("usage"), time.perf_counter() - started)
    choice = body["choices"][0]
    capture.save_exchange(kind, system, user, choice["message"]["content"] or "", body.get("usage"))
    usage.record_exchange(kind, system, user, choice["message"]["content"] or "")
    try:
        return _parse_json(choice["message"]["content"] or "")
    except ValueError:
        logger.warning("Unparseable model output (finish=%s): %.200s", choice.get("finish_reason"), choice["message"]["content"])
        raise


def _response_format(schema: Type[BaseModel] | None, model: str) -> dict:
    if schema is None or model in _schema_unsupported or os.getenv("NOVA_JSON_SCHEMA") == "off":
        return {"type": "json_object"}
    return {"type": "json_schema", "json_schema": {"name": schema.__name__.lower(), "strict": False, "schema": _schema_of(schema)}}


@lru_cache(maxsize=None)
def _schema_of(schema: Type[BaseModel]) -> dict:
    return schema.model_json_schema()


async def _post(payload: dict, key: str, kind: str) -> httpx.Response:
    """One chat request, waiting for a free slot and retrying rate limits, server errors and timeouts."""
    async with _gate():
        for delay in (*RETRY_DELAYS, None):
            try:
                async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                    response = await client.post(f"{base_url()}/chat/completions", headers={"Authorization": f"Bearer {key}"}, json=payload)
                if response.status_code not in RETRY_STATUSES or delay is None:
                    return response
                logger.warning("Model endpoint responded %s, retrying", response.status_code)
                await usage.record_retry(kind, payload["model"])
            except httpx.TimeoutException:
                if delay is None:
                    logger.warning("Model request timed out")
                    await usage.record_failure(kind, payload["model"])
                    raise HTTPException(503, "The model timed out")
                await usage.record_retry(kind, payload["model"])
            except httpx.HTTPError as error:
                if delay is None:
                    logger.warning("Model request failed: %s", error)
                    await usage.record_failure(kind, payload["model"])
                    raise HTTPException(502, "Could not reach the model")
                await usage.record_retry(kind, payload["model"])
            await asyncio.sleep(delay * random.uniform(0.8, 1.2))
    raise AssertionError("unreachable")


def _gate() -> asyncio.Semaphore:
    """At most MAX_PARALLEL_CALLS model requests at once across all visitors."""
    return _gates.setdefault(asyncio.get_running_loop(), asyncio.Semaphore(MAX_PARALLEL_CALLS))


async def chat_text(messages: list, model: str, max_tokens: int = 700) -> str:
    """One plain chat completion, returned whole."""
    key = api_key()
    if not key:
        raise HTTPException(503, "Tutor model is not configured")
    payload = {"model": model, "messages": messages, "temperature": 0.4, "max_tokens": max_tokens}
    started = time.perf_counter()
    response = await _post(payload, key, "tutor")
    await _raise_for_upstream(response, "tutor", model)
    body = response.json()
    await usage.record_call("tutor", model, body.get("usage"), time.perf_counter() - started)
    reply = body["choices"][0]["message"]["content"] or ""
    capture.save_exchange("tutor", messages[0]["content"], messages[-1]["content"], reply, body.get("usage"))
    usage.record_exchange("tutor", messages[0]["content"], messages[-1]["content"], reply)
    return reply


async def ask(schema: Type[T], system: str, user: str, max_tokens: int = DEFAULT_MAX_TOKENS, thinking: bool = False, kind: str = "call") -> T:
    """Asks for JSON and validates it, asking again when the answer is unusable.

    The model answers straight away instead of reasoning first (thinking=True or NOVA_THINKING=on lets it
    reason): on the Nano model reasoning often used up the whole token limit before the JSON began.
    """
    asked = user
    for attempt in range(ATTEMPTS):
        # The last try of a call whose model keeps giving unusable answers goes to the fallback model.
        backup = fallback_for(model_for(kind)) if attempt == ATTEMPTS - 1 and ATTEMPTS > 1 else None
        token = _forced_model.set(backup) if backup else None
        try:
            return schema.model_validate(await chat_json(system, asked, max_tokens, thinking, schema, kind))
        except (ValidationError, ValueError) as error:
            logger.warning("Unusable model answer (attempt %d): %s", attempt + 1, str(error)[:300])
            asked = user + _rejection_note(error)
            await usage.record_retry(kind, model_for(kind))
        finally:
            if token is not None:
                _forced_model.reset(token)
    await usage.record_failure(kind, model_for(kind))
    raise HTTPException(502, "The course model returned an unusable answer")


def _rejection_note(error: Exception) -> str:
    """What to add to the request when the last answer was unusable, so the model can fix that instead of repeating it."""
    if isinstance(error, ValidationError):
        problems = [f"{'.'.join(str(part) for part in item['loc']) or 'answer'}: {item['msg'].removeprefix('Value error, ')}" for item in error.errors()[:4]]
    else:
        problems = [str(error)[:200]]
    return "\n\nYour previous answer was rejected. Write the whole answer again and fix this:\n- " + "\n- ".join(problems)


async def _raise_for_upstream(response: httpx.Response, kind: str, model: str) -> None:
    """Like raise_for_upstream, and counts the failure in the usage ledger."""
    try:
        raise_for_upstream(response)
    except HTTPException:
        await usage.record_failure(kind, model)
        raise


def raise_for_upstream(response: httpx.Response) -> None:
    if response.status_code == 200:
        return
    logger.warning("Model endpoint responded %s: %s", response.status_code, response.text[:500])
    if response.status_code == 429:
        raise HTTPException(503, "The model is busy, try again shortly")
    raise HTTPException(502, f"Model endpoint responded {response.status_code}")


def _parse_json(text: str) -> dict:
    """The largest JSON object in the text; models sometimes add reasoning or code fences around it."""
    decoder = json.JSONDecoder()
    found, position = [], text.find("{")
    while position != -1:
        try:
            data, end = decoder.raw_decode(text, position)
        except ValueError:
            position = text.find("{", position + 1)
            continue
        if isinstance(data, dict):
            found.append((end - position, data))
        position = text.find("{", end)
    if not found:
        raise ValueError("The model did not return a JSON object")
    return max(found, key=lambda item: item[0])[1]
