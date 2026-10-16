import asyncio
import json
import logging
import os
import random

import httpx
from fastapi import HTTPException

logger = logging.getLogger("nova.llm")

DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1"
DEFAULT_MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
TIMEOUT = httpx.Timeout(120.0, connect=10.0)
MAX_PARALLEL_CALLS = 16
RETRY_DELAYS = (1.0, 3.0)
RETRY_STATUSES = {429, 500, 502, 503, 504}
_gates: dict = {}


# --- Settings ---

def api_key() -> str | None:
    return os.getenv("NEBIUS_API_KEY")


def base_url() -> str:
    return os.getenv("NEBIUS_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def generate_model() -> str:
    return os.getenv("NOVA_GENERATE_MODEL", DEFAULT_MODEL)


def tutor_model() -> str:
    return os.getenv("NOVA_TUTOR_MODEL", DEFAULT_MODEL)


# --- Requests ---


async def chat_json(system: str, user: str) -> dict:
    """One chat completion that must come back as a JSON object."""
    key = api_key()
    if not key:
        raise HTTPException(503, "Course model is not configured")

    payload = {
        "model": generate_model(),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_object"},
        "temperature": 0.4,
        "max_tokens": 7000,
    }
    response = await _post(payload, key)
    raise_for_upstream(response)
    choice = response.json()["choices"][0]
    try:
        return _parse_json(choice["message"]["content"] or "")
    except ValueError:
        logger.warning("Unparseable model output (finish=%s): %.200s", choice.get("finish_reason"), choice["message"]["content"])
        raise


async def _post(payload: dict, key: str) -> httpx.Response:
    """One chat request, waiting for a free slot and retrying rate limits, server errors and timeouts."""
    async with _gate():
        for delay in (*RETRY_DELAYS, None):
            try:
                async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                    response = await client.post(f"{base_url()}/chat/completions", headers={"Authorization": f"Bearer {key}"}, json=payload)
                if response.status_code not in RETRY_STATUSES or delay is None:
                    return response
                logger.warning("Model endpoint responded %s, retrying", response.status_code)
            except httpx.TimeoutException:
                if delay is None:
                    logger.warning("Model request timed out")
                    raise HTTPException(503, "The model timed out")
            except httpx.HTTPError as error:
                if delay is None:
                    logger.warning("Model request failed: %s", error)
                    raise HTTPException(502, "Could not reach the model")
            await asyncio.sleep(delay * random.uniform(0.8, 1.2))
    raise AssertionError("unreachable")


def _gate() -> asyncio.Semaphore:
    """At most MAX_PARALLEL_CALLS model requests at once across all visitors."""
    return _gates.setdefault(asyncio.get_running_loop(), asyncio.Semaphore(MAX_PARALLEL_CALLS))


def raise_for_upstream(response: httpx.Response) -> None:
    if response.status_code == 200:
        return
    logger.warning("Model endpoint responded %s: %s", response.status_code, response.text[:500])
    if response.status_code == 429:
        raise HTTPException(503, "The model is busy, try again shortly")
    raise HTTPException(502, f"Model endpoint responded {response.status_code}")


def _parse_json(text: str) -> dict:
    # Models sometimes wrap the object in prose or code fences
    start, end = text.find("{"), text.rfind("}")
    try:
        data = json.loads(text[start : end + 1])
    except ValueError:
        raise ValueError("The model did not return JSON")
    if not isinstance(data, dict):
        raise ValueError("The model did not return a JSON object")
    return data
