import asyncio
import logging
import os
import time
from contextvars import ContextVar

import httpx
from fastapi import HTTPException

import pricing
import shared

logger = logging.getLogger("nova.usage")

KINDS = ("outline", "module", "lesson", "quiz", "practice", "module quiz", "answers", "safety", "placement", "judge", "tutor")
LATENCY_EDGES = (1, 3, 10, 30)
LEDGER_SECONDS = 90 * 24 * 3600
BUDGET_WINDOW_SECONDS = 2 * 24 * 3600
BUDGET_WARNING_SHARE = 0.8


class RequestUsage:
    """What one request cost: model calls, tokens, retries and failures."""

    def __init__(self):
        self.calls = 0
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.retries = 0
        self.failures = 0
        self.seconds_by_kind: dict[str, list[float]] = {}

    @property
    def tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    @property
    def cost_usd(self) -> float:
        return pricing.cost_usd(self.prompt_tokens, self.completion_tokens)

    def as_dict(self) -> dict:
        return {"calls": self.calls, "prompt_tokens": self.prompt_tokens, "completion_tokens": self.completion_tokens, "cost_usd": round(self.cost_usd, 6), "retries": self.retries, "failures": self.failures}

    def describe(self) -> str:
        return f"calls={self.calls} tokens={self.tokens} ~${self.cost_usd:.4f} retries={self.retries}"


_current: ContextVar[RequestUsage | None] = ContextVar("usage", default=None)


# --- Per request ---

def begin() -> RequestUsage:
    usage = RequestUsage()
    _current.set(usage)
    return usage


def current() -> RequestUsage | None:
    return _current.get()


# --- Ledger (what every model call cost, by day, model and kind) ---

def _day(timestamp: float | None = None) -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(timestamp))


def ledger_key(day: str, model: str) -> str:
    return f"nova:usage:{day}:{model}"


def events_key(day: str) -> str:
    return f"nova:events:{day}"


def _bucket(seconds: float) -> str:
    for edge in LATENCY_EDGES:
        if seconds <= edge:
            return f"le_{edge}"
    return "le_inf"


async def _add(key: str, amounts: dict[str, int]) -> None:
    try:
        await shared.state.hincr_many(key, amounts, LEDGER_SECONDS)
    except shared.StateError as error:
        logger.warning("Usage not recorded: %s", error)


async def record_call(kind: str, model: str, tokens_used: dict | None, seconds: float) -> None:
    """Counts one finished model call for its request, the ledger and the day's budget."""
    prompt, completion = int((tokens_used or {}).get("prompt_tokens") or 0), int((tokens_used or {}).get("completion_tokens") or 0)
    spent = current()
    if spent:
        spent.calls += 1
        spent.prompt_tokens += prompt
        spent.completion_tokens += completion
        spent.seconds_by_kind.setdefault(kind, []).append(seconds)
    logger.debug("model call %s: %d tokens in %.1f s", kind, prompt + completion, seconds)
    amounts = {"calls": 1, "prompt": prompt, "completion": completion, "millis": round(seconds * 1000), _bucket(seconds): 1}
    await asyncio.gather(_add(ledger_key(_day(), model), {f"{kind}:{name}": amount for name, amount in amounts.items()}), _charge(prompt + completion))


async def record_retry(kind: str, model: str) -> None:
    spent = current()
    if spent:
        spent.retries += 1
    await _add(ledger_key(_day(), model), {f"{kind}:retries": 1})


async def record_failure(kind: str, model: str) -> None:
    """A call that gave up: the endpoint failed, or the answer stayed unusable."""
    spent = current()
    if spent:
        spent.failures += 1
    await _add(ledger_key(_day(), model), {f"{kind}:failures": 1})


async def record_event(name: str) -> None:
    """Counts something that is not a model call: a cache hit or miss, a request turned away."""
    await _add(events_key(_day()), {name: 1})


# --- Reading the ledger ---

async def daily_report(days: int, models: list[str]) -> list[dict]:
    """Per day (newest first) and per kind: calls, tokens, estimated cost, latency, retries and failures."""
    stamps = [time.time() - number * 86400 for number in range(days)]
    return [await _report_day(_day(stamp), models) for stamp in stamps]


async def _report_day(day: str, models: list[str]) -> dict:
    kinds: dict[str, dict] = {}
    for model in models:
        try:
            counters = await shared.state.hgetall(ledger_key(day, model))
        except shared.StateError as error:
            logger.warning("Usage not read: %s", error)
            counters = {}
        for kind in KINDS:
            row = _kind_row(kind, counters)
            if row["calls"] or row["failures"] or row["retries"]:
                kinds[kind] = _merge(kinds.get(kind), row)
    totals = _merge_all(list(kinds.values()))
    return {"day": day, "kinds": kinds, "totals": totals, "events": await _events(day)}


def _kind_row(kind: str, counters: dict[str, int]) -> dict:
    get = lambda name: counters.get(f"{kind}:{name}", 0)
    calls = get("calls")
    return {
        "calls": calls,
        "prompt_tokens": get("prompt"),
        "completion_tokens": get("completion"),
        "cost_usd": pricing.cost_usd(get("prompt"), get("completion")),
        "seconds": get("millis") / 1000,
        "average_seconds": get("millis") / 1000 / calls if calls else 0.0,
        "latency": {f"le_{edge}": get(f"le_{edge}") for edge in LATENCY_EDGES} | {"le_inf": get("le_inf")},
        "retries": get("retries"),
        "failures": get("failures"),
    }


def _merge(first: dict | None, second: dict) -> dict:
    if first is None:
        return second
    merged = {key: first[key] + second[key] for key in ("calls", "prompt_tokens", "completion_tokens", "cost_usd", "seconds", "retries", "failures")}
    merged["latency"] = {edge: first["latency"][edge] + second["latency"][edge] for edge in first["latency"]}
    merged["average_seconds"] = merged["seconds"] / merged["calls"] if merged["calls"] else 0.0
    return merged


def _merge_all(rows: list[dict]) -> dict:
    total = _kind_row("", {})
    for row in rows:
        total = _merge(total, row)
    return total


async def _events(day: str) -> dict[str, int]:
    try:
        return await shared.state.hgetall(events_key(day))
    except shared.StateError:
        return {}


# --- Daily budget ---

def daily_limit() -> int:
    return int(os.getenv("NOVA_DAILY_TOKEN_BUDGET") or 0)


def _budget_key() -> str:
    return "nova:tokens:" + _day()


async def used_today() -> int:
    try:
        return int(await shared.state.get(_budget_key()) or 0)
    except shared.StateError as error:
        logger.warning("Budget check skipped: %s", error)
        return 0


async def _charge(tokens: int) -> None:
    if not daily_limit() or not tokens:
        return
    try:
        total = await shared.state.add(_budget_key(), tokens, BUDGET_WINDOW_SECONDS)
    except shared.StateError as error:
        logger.warning("Token count skipped: %s", error)
        return
    await _warn_near_budget(total - tokens, total)


async def _warn_near_budget(before: int, after: int) -> None:
    """Logs once, when the day's tokens first cross 80% of the budget."""
    line = daily_limit() * BUDGET_WARNING_SHARE
    if before < line <= after:
        message = f"NOVA daily token budget is {BUDGET_WARNING_SHARE:.0%} used ({after} of {daily_limit()} tokens)"
        logger.warning(message)
        await _send_alert(message)


async def _send_alert(message: str) -> None:
    """Posts the message to NOVA_ALERT_WEBHOOK (a Slack-style incoming webhook) when one is set."""
    url = os.getenv("NOVA_ALERT_WEBHOOK")
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, json={"text": message})
    except httpx.HTTPError as error:
        logger.warning("Alert not sent: %s", error)


async def check_budget() -> None:
    """A route dependency: no new work once the day's token budget (NOVA_DAILY_TOKEN_BUDGET) is used up."""
    if not daily_limit():
        return
    used = await used_today()
    if used >= daily_limit():
        logger.warning("Daily token budget reached (%d)", used)
        raise HTTPException(503, "NOVA has used its AI budget for today. Please try again tomorrow.")
