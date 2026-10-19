import time

import usage
from evals.metrics import first_try_rate, retry_rate


def start(suite: str, **fields) -> dict:
    """A fresh result row and a fresh cost counter for one run."""
    usage.begin()
    return {"suite": suite, **fields, "_started": time.perf_counter()}


def finish(row: dict) -> dict:
    """Adds what the run cost: seconds, calls, tokens, estimated dollars, retries and per-kind latency."""
    spent = usage.current()
    row.update(
        seconds=round(time.perf_counter() - row.pop("_started"), 1),
        calls=spent.calls,
        prompt_tokens=spent.prompt_tokens,
        completion_tokens=spent.completion_tokens,
        tokens=spent.tokens,
        cost_usd=round(spent.cost_usd, 6),
        retries=spent.retries,
        retry_rate=retry_rate(spent.calls, spent.retries),
        first_try=first_try_rate(spent.calls, spent.retries),
        kind_seconds={kind: [round(value, 2) for value in values] for kind, values in spent.seconds_by_kind.items()},
    )
    return row
