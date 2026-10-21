import json
import logging
import time

import shared
from usage import RequestUsage

logger = logging.getLogger("nova.traces")

MAX_PER_DAY = 500
KEEP_SECONDS = 7 * 24 * 3600


# --- A request as one record ---

def build_record(spent: RequestUsage, request_id: str, method: str, path: str, status: int, seconds: float) -> dict:
    """What one request did with the model: its totals, each call in order, remarks, and the text of the calls when that is switched on."""
    record = {
        "request_id": request_id,
        "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "method": method,
        "path": path,
        "status": status,
        "seconds": round(seconds, 2),
        "calls": spent.calls,
        "prompt_tokens": spent.prompt_tokens,
        "completion_tokens": spent.completion_tokens,
        "cost_usd": round(spent.cost_usd, 6),
        "retries": spent.retries,
        "failures": spent.failures,
        "call_log": spent.call_log,
        "notes": spent.notes,
        "problem": bool(spent.failures or spent.retries or spent.notes or status >= 400),
    }
    if spent.exchanges:
        record["exchanges"] = spent.exchanges
    return record


# --- Keeping and reading them ---

def _key(stamp: float) -> str:
    return "nova:traces:" + time.strftime("%Y-%m-%d", time.gmtime(stamp))


async def save(record: dict) -> None:
    """Keeps the newest records of the day for a week; a store that cannot be reached never hurts the request."""
    try:
        await shared.state.push_capped(_key(time.time()), json.dumps(record), MAX_PER_DAY, KEEP_SECONDS)
    except shared.StateError as error:
        logger.warning("Trace not saved: %s", error)


async def recent(limit: int, only_problems: bool = False) -> list[dict]:
    """The newest records of today and yesterday, newest first."""
    found: list[dict] = []
    for stamp in (time.time(), time.time() - 86400):
        try:
            raw = await shared.state.recent(_key(stamp), MAX_PER_DAY)
        except shared.StateError as error:
            logger.warning("Traces not read: %s", error)
            continue
        found += [record for record in map(json.loads, raw) if record["problem"] or not only_problems]
    return sorted(found, key=lambda record: record["time"], reverse=True)[:limit]
