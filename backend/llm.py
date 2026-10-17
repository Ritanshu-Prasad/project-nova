import asyncio
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

logger = logging.getLogger("nova.llm")

DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1"
DEFAULT_MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
TIMEOUT = httpx.Timeout(120.0, connect=10.0)
ATTEMPTS = 3
DEFAULT_MAX_TOKENS = 5000
MAX_PARALLEL_CALLS = 16
RETRY_DELAYS = (1.0, 3.0)
RETRY_STATUSES = {429, 500, 502, 503, 504}
_gates: dict = {}
_schema_supported = [True]
_warned_settings: set = set()

T = TypeVar("T", bound=BaseModel)


# --- Settings ---

def api_key() -> str | None:
    return os.getenv("NEBIUS_API_KEY")


def base_url() -> str:
    return os.getenv("NEBIUS_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def generate_model() -> str:
    return _allowed(os.getenv("NOVA_GENERATE_MODEL", DEFAULT_MODEL), "NOVA_GENERATE_MODEL")


def tutor_model() -> str:
    return _allowed(os.getenv("NOVA_TUTOR_MODEL", DEFAULT_MODEL), "NOVA_TUTOR_MODEL")


def models_in_use() -> dict:
    """The models requests really use, and which settings asked for a model that is not allowed."""
    settings = {"NOVA_GENERATE_MODEL": generate_model(), "NOVA_TUTOR_MODEL": tutor_model()}
    refused = [name for name, used in settings.items() if os.getenv(name, DEFAULT_MODEL) != used]
    return {"generate": settings["NOVA_GENERATE_MODEL"], "tutor": settings["NOVA_TUTOR_MODEL"], "refused_settings": refused}


def _allowed(configured: str, setting: str) -> str:
    """Only the Nano model is used unless NOVA_ALLOWED_MODELS names others on purpose, so a wrong setting cannot cost more."""
    allowed = {DEFAULT_MODEL, *(name.strip() for name in os.getenv("NOVA_ALLOWED_MODELS", "").split(",") if name.strip())}
    if configured in allowed:
        return configured
    if setting not in _warned_settings:
        _warned_settings.add(setting)
        logger.error("%s=%s is not an allowed model, using %s instead (NOVA_ALLOWED_MODELS widens the list)", setting, configured, DEFAULT_MODEL)
    return DEFAULT_MODEL


# --- Requests ---


async def chat_json(system: str, user: str, max_tokens: int = DEFAULT_MAX_TOKENS, thinking: bool = False, schema: Type[BaseModel] | None = None, kind: str = "call") -> dict:
    """One chat completion that must come back as a JSON object, shaped by `schema` when the endpoint allows it."""
    key = api_key()
    if not key:
        raise HTTPException(503, "Course model is not configured")

    payload = {
        "model": generate_model(),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": _response_format(schema),
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }
    if not (thinking or os.getenv("NOVA_THINKING") == "on"):
        payload["chat_template_kwargs"] = {"enable_thinking": False}
    started = time.perf_counter()
    response = await _post(payload, key, kind)
    if response.status_code == 400 and payload["response_format"]["type"] == "json_schema":
        logger.warning("Endpoint rejected the JSON schema for %s, using plain JSON from now on: %.200s", kind, response.text)
        _schema_supported[0] = False
        response = await _post({**payload, "response_format": {"type": "json_object"}}, key, kind)
    await _raise_for_upstream(response, kind, payload["model"])
    body = response.json()
    await usage.record_call(kind, payload["model"], body.get("usage"), time.perf_counter() - started)
    choice = body["choices"][0]
    capture.save_exchange(kind, system, user, choice["message"]["content"] or "", body.get("usage"))
    try:
        return _parse_json(choice["message"]["content"] or "")
    except ValueError:
        logger.warning("Unparseable model output (finish=%s): %.200s", choice.get("finish_reason"), choice["message"]["content"])
        raise


def _response_format(schema: Type[BaseModel] | None) -> dict:
    if schema is None or not _schema_supported[0] or os.getenv("NOVA_JSON_SCHEMA") == "off":
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
    return reply


async def ask(schema: Type[T], system: str, user: str, max_tokens: int = DEFAULT_MAX_TOKENS, thinking: bool = False, kind: str = "call") -> T:
    """Asks for JSON and validates it, asking again when the answer is unusable.

    The model answers straight away instead of reasoning first (thinking=True or NOVA_THINKING=on lets it
    reason): on the Nano model reasoning often used up the whole token limit before the JSON began.
    """
    for attempt in range(ATTEMPTS):
        try:
            return schema.model_validate(await chat_json(system, user, max_tokens, thinking, schema, kind))
        except (ValidationError, ValueError) as error:
            logger.warning("Unusable model answer (attempt %d): %s", attempt + 1, str(error)[:300])
            await usage.record_retry(kind, generate_model())
    await usage.record_failure(kind, generate_model())
    raise HTTPException(502, "The course model returned an unusable answer")


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
