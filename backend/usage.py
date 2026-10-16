import logging
import os
import time
from contextvars import ContextVar

from fastapi import HTTPException

import shared

logger = logging.getLogger("nova.usage")

BUDGET_WINDOW_SECONDS = 2 * 24 * 3600


class RequestUsage:
    """What one request cost: model calls, tokens and retries."""

    def __init__(self):
        self.calls = 0
        self.tokens = 0
        self.retries = 0

    def describe(self) -> str:
        return f"calls={self.calls} tokens={self.tokens} retries={self.retries}"


_current: ContextVar[RequestUsage | None] = ContextVar("usage", default=None)


# --- Per request ---

def begin() -> RequestUsage:
    usage = RequestUsage()
    _current.set(usage)
    return usage


def current() -> RequestUsage | None:
    return _current.get()


def record_retry() -> None:
    usage = current()
    if usage:
        usage.retries += 1


async def record_call(kind: str, tokens_used: dict | None, seconds: float) -> None:
    """Counts one finished model call for its request and for the day's budget."""
    tokens = int((tokens_used or {}).get("total_tokens") or 0)
    usage = current()
    if usage:
        usage.calls += 1
        usage.tokens += tokens
    logger.debug("model call %s: %d tokens in %.1f s", kind, tokens, seconds)
    await _charge(tokens)


# --- Daily budget ---

def daily_limit() -> int:
    return int(os.getenv("NOVA_DAILY_TOKEN_BUDGET") or 0)


def _today() -> str:
    return "nova:tokens:" + time.strftime("%Y-%m-%d", time.gmtime())


async def _charge(tokens: int) -> None:
    if not daily_limit() or not tokens:
        return
    try:
        await shared.state.add(_today(), tokens, BUDGET_WINDOW_SECONDS)
    except shared.StateError as error:
        logger.warning("Token count skipped: %s", error)


async def check_budget() -> None:
    """A route dependency: no new work once the day's token budget (NOVA_DAILY_TOKEN_BUDGET) is used up."""
    if not daily_limit():
        return
    try:
        used = int(await shared.state.get(_today()) or 0)
    except shared.StateError as error:
        logger.warning("Budget check skipped: %s", error)
        return
    if used >= daily_limit():
        logger.warning("Daily token budget reached (%d)", used)
        raise HTTPException(503, "NOVA has used its AI budget for today. Please try again tomorrow.")
