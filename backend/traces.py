import time

import records
from usage import RequestUsage


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

NAME = "traces"
MAX_PER_DAY = 500


async def save(record: dict) -> None:
    await records.push(NAME, record, MAX_PER_DAY)


async def recent(limit: int, only_problems: bool = False) -> list[dict]:
    """The newest records of today and yesterday, newest first."""
    return [record for record in await records.newest(NAME, MAX_PER_DAY) if record["problem"] or not only_problems][:limit]
