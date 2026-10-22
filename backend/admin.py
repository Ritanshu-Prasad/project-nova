import hmac
import os
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, PlainTextResponse

import errors
import llm
import pricing
import traces
import usage

router = APIRouter()

PAGE = Path(__file__).with_name("admin.html")


# --- Who may look ---

def _authorise(request: Request) -> None:
    """The admin pages exist only when NOVA_ADMIN_TOKEN is set, and need it as a bearer token."""
    expected = os.getenv("NOVA_ADMIN_TOKEN")
    if not expected:
        raise HTTPException(404, "Not found")
    presented = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(presented.encode(), expected.encode()):
        raise HTTPException(401, "Wrong or missing admin token", headers={"WWW-Authenticate": "Bearer"})


def _models() -> list[str]:
    in_use = llm.models_in_use()
    return list(dict.fromkeys([in_use["generate"], in_use["tutor"]]))


# --- Routes ---

@router.get("/api/admin/usage")
async def usage_report(request: Request, days: int = Query(7, ge=1, le=90)):
    """When the model was used, with how many tokens, and what that costs at the configured price."""
    _authorise(request)
    return {
        "models": llm.models_in_use(),
        "price_per_million": asdict(pricing.current_price()),
        "budget": {"daily_token_limit": usage.daily_limit() or None, "used_today": await usage.used_today()},
        "days": await usage.daily_report(days, _models()),
    }


@router.get("/api/admin/traces")
async def trace_list(request: Request, limit: int = Query(50, ge=1, le=200), problems: bool = False):
    """The newest requests that used the model, each with its calls, tokens, cost and remarks; the text of the calls is there only when NOVA_TRACE_CONTENT=on."""
    _authorise(request)
    return {"traces": await traces.recent(limit, only_problems=problems), "content_saved": os.getenv("NOVA_TRACE_CONTENT") == "on"}


@router.get("/api/admin/errors")
async def error_list(request: Request, limit: int = Query(50, ge=1, le=200)):
    """The newest unhandled errors, with where they happened and which request they broke."""
    _authorise(request)
    return {"errors": await errors.recent(limit)}


@router.get("/api/admin/metrics", response_class=PlainTextResponse)
async def metrics(request: Request):
    """Today's numbers in the Prometheus text format, for Grafana or any scraper."""
    _authorise(request)
    today = (await usage.daily_report(1, _models()))[0]
    return render_metrics(today, daily_limit=usage.daily_limit(), used_today=await usage.used_today())


@router.get("/api/admin", response_class=HTMLResponse)
@router.get("/admin", response_class=HTMLResponse)
async def admin_page():
    """A page that shows the usage report; it asks for the token itself, so the token never travels in a URL. /api/admin also works behind the dev proxy and on Vercel, which only send /api to the backend."""
    if not os.getenv("NOVA_ADMIN_TOKEN"):
        raise HTTPException(404, "Not found")
    return PAGE.read_text(encoding="utf-8")


# --- Prometheus text ---

def render_metrics(today: dict, daily_limit: int, used_today: int) -> str:
    lines: list[str] = []

    def metric(name: str, kind: str, help_text: str, samples: list[tuple[dict, float]]) -> None:
        lines.extend([f"# HELP {name} {help_text}", f"# TYPE {name} {kind}"])
        lines.extend(f"{name}{_labels(labels)} {value}" for labels, value in samples)

    kinds = today["kinds"]
    metric("nova_model_calls_today", "gauge", "Model calls today, by kind.", [({"kind": k}, row["calls"]) for k, row in kinds.items()])
    metric("nova_model_tokens_today", "gauge", "Model tokens today, by kind and direction.", [({"kind": k, "type": t}, row[f"{t}_tokens"]) for k, row in kinds.items() for t in ("prompt", "completion")])
    metric("nova_model_cost_usd_today", "gauge", "Estimated model cost today in US dollars.", [({"kind": k}, round(row["cost_usd"], 6)) for k, row in kinds.items()])
    metric("nova_model_retries_today", "gauge", "Model calls that had to be tried again today.", [({"kind": k}, row["retries"]) for k, row in kinds.items()])
    metric("nova_model_failures_today", "gauge", "Model calls that gave up today.", [({"kind": k}, row["failures"]) for k, row in kinds.items()])
    metric("nova_events_today", "gauge", "Cache hits and misses and turned-away requests today.", [({"event": name}, count) for name, count in today["events"].items()])
    metric("nova_budget_tokens_used", "gauge", "Tokens used against today's budget.", [({}, used_today)])
    metric("nova_budget_tokens_limit", "gauge", "Today's token budget (0 means none).", [({}, daily_limit)])
    lines.extend(_latency(kinds))
    return "\n".join(lines) + "\n"


def _latency(kinds: dict) -> list[str]:
    lines = ["# HELP nova_model_latency_seconds How long model calls took today.", "# TYPE nova_model_latency_seconds histogram"]
    for kind, row in kinds.items():
        cumulative = 0
        for edge in (*usage.LATENCY_EDGES, "inf"):
            cumulative += row["latency"][f"le_{edge}"]
            lines.append(f'nova_model_latency_seconds_bucket{_labels({"kind": kind, "le": "+Inf" if edge == "inf" else str(edge)})} {cumulative}')
        lines.append(f"nova_model_latency_seconds_sum{_labels({'kind': kind})} {round(row['seconds'], 3)}")
        lines.append(f"nova_model_latency_seconds_count{_labels({'kind': kind})} {row['calls']}")
    return lines


def _labels(labels: dict) -> str:
    return "{" + ",".join(f'{name}="{value}"' for name, value in labels.items()) + "}" if labels else ""
