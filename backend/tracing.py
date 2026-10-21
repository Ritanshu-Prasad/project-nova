import asyncio
import logging
import os

import pricing
from request_context import request_id_var

logger = logging.getLogger("nova.tracing")

_client = None


# --- Switch ---

def enabled() -> bool:
    """Tracing is off unless a Langfuse project is configured."""
    return all(os.getenv(name) for name in ("LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_HOST"))


def with_content() -> bool:
    """Prompts and replies hold what learners typed and uploaded, so they are only sent when asked for."""
    return os.getenv("NOVA_TRACE_CONTENT") == "on"


def _make_client():
    from langfuse import Langfuse

    return Langfuse(public_key=os.environ["LANGFUSE_PUBLIC_KEY"], secret_key=os.environ["LANGFUSE_SECRET_KEY"], host=os.environ["LANGFUSE_HOST"])


def client():
    global _client
    if not enabled():
        return None
    if _client is None:
        _client = _make_client()
    return _client


def _trace_id(langfuse) -> str:
    """The request id as a trace id, so a log line and its trace can be matched."""
    request_id = request_id_var.get()
    return langfuse.create_trace_id(seed=request_id if request_id != "-" else None)


# --- Recording ---

def record_generation(kind: str, model: str, system: str, user: str, reply: str, tokens: dict | None, seconds: float) -> None:
    """One model call as one generation of the request's trace. It never blocks the request and never raises."""
    langfuse = client()
    if langfuse is None:
        return
    prompt, completion = int((tokens or {}).get("prompt_tokens") or 0), int((tokens or {}).get("completion_tokens") or 0)
    try:
        content = with_content()
        langfuse.start_observation(
            trace_context={"trace_id": _trace_id(langfuse)},
            name=kind,
            as_type="generation",
            model=model,
            input=[{"role": "system", "content": system}, {"role": "user", "content": user}] if content else None,
            output=reply if content else None,
            usage_details={"input": prompt, "output": completion},
            cost_details={"total": round(pricing.cost_usd(prompt, completion), 8)},
            metadata={"seconds": round(seconds, 2)},
        ).end()
    except Exception as error:
        logger.warning("Trace not recorded: %s", error)


def record_failure(kind: str, model: str) -> None:
    """A model call that gave up, shown as an error in the request's trace."""
    langfuse = client()
    if langfuse is None:
        return
    try:
        langfuse.start_observation(trace_context={"trace_id": _trace_id(langfuse)}, name=kind, as_type="generation", model=model, level="ERROR", status_message="the call gave up").end()
    except Exception as error:
        logger.warning("Trace failure not recorded: %s", error)


def score(name: str, value: float, comment: str = "") -> None:
    """A quality signal on the request's trace, such as how many questions failed the wording check."""
    langfuse = client()
    if langfuse is None:
        return
    try:
        langfuse.create_score(name=name, value=value, trace_id=_trace_id(langfuse), data_type="NUMERIC", comment=comment or None)
    except Exception as error:
        logger.warning("Score not recorded: %s", error)


def flush() -> None:
    """Sends what is waiting; a serverless function may be frozen as soon as it answers."""
    langfuse = client()
    if langfuse is None:
        return
    try:
        langfuse.flush()
    except Exception as error:
        logger.warning("Traces not sent: %s", error)


async def flush_within(seconds: float = 2.0) -> None:
    """Sends what is waiting, but never makes a request wait longer than `seconds` for it."""
    try:
        await asyncio.wait_for(asyncio.to_thread(flush), seconds)
    except asyncio.TimeoutError:
        logger.warning("Traces still being sent after %.0f s, not waiting", seconds)
