import asyncio
import json
import logging
import os
import re
import time
import uuid

from fastapi import APIRouter, FastAPI, Request

import accounts
import llm
import pricing
import shared
import usage
from request_context import request_id_var

router = APIRouter()
logger = logging.getLogger("nova.requests")

VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
STARTED = time.time()
STORAGE_PROBE_SECONDS = 3


# --- Logging ---

class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line, for log services; a request's cost rides along as `usage`."""

    def format(self, record: logging.LogRecord) -> str:
        line = {
            "time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "message": record.getMessage(),
        }
        if hasattr(record, "usage"):
            line["usage"] = record.usage
        if record.exc_info:
            line["exception"] = self.formatException(record.exc_info)
        return json.dumps(line, ensure_ascii=False)


def configure_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(level=level, format="%(asctime)s [%(levelname)s] [%(name)s] [%(request_id)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    for handler in logging.getLogger().handlers:
        handler.addFilter(RequestIdFilter())
        if os.getenv("LOG_FORMAT") == "json":
            handler.setFormatter(JsonFormatter())


def add_request_logging(app: FastAPI) -> None:
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        incoming = request.headers.get("x-request-id", "")
        request_id = incoming if VALID_REQUEST_ID.match(incoming) else uuid.uuid4().hex[:12]
        token = request_id_var.set(request_id)
        spent = usage.begin()
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("%s %s -> failed", request.method, request.url.path)
            raise
        else:
            elapsed = (time.perf_counter() - started) * 1000
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{elapsed:.0f}ms"
            cost = f" [{spent.describe()}]" if spent.calls else ""
            logger.info("%s %s -> %s (%.0f ms)%s", request.method, request.url.path, response.status_code, elapsed, cost, extra={"usage": spent.as_dict()} if spent.calls else {})
            return response
        finally:
            request_id_var.reset(token)


def log_startup() -> None:
    """One line at boot saying which models and features this server runs with."""
    models = llm.models_in_use()
    features = {
        "moderation": os.getenv("NOVA_MODERATION") != "off",
        "answer_check": os.getenv("NOVA_VERIFY_ANSWERS") != "off",
        "json_schema": os.getenv("NOVA_JSON_SCHEMA") != "off",
        "thinking": os.getenv("NOVA_THINKING") == "on",
        "cache": os.getenv("NOVA_CACHE") != "off",
        "rate_limits": os.getenv("NOVA_RATE_LIMIT") != "off",
        "store": "redis" if isinstance(shared.state, shared.RedisState) else "memory",
        "daily_token_budget": usage.daily_limit() or "none",
        "price_per_million_in_out": f"{pricing.current_price().input_per_million}/{pricing.current_price().output_per_million}",
    }
    logger.info("Models: generate=%s tutor=%s | %s", models["generate"], models["tutor"], " ".join(f"{name}={value}" for name, value in features.items()))


# --- Health ---

@router.get("/api/health")
async def health():
    storage_mode, storage_state = await _storage_state()
    return {
        "status": "healthy" if storage_state != "unreachable" else "degraded",
        "timestamp": int(time.time() * 1000),
        "uptime_seconds": round(time.time() - STARTED, 1),
        "models": llm.models_in_use(),
        "services": {
            "storage": storage_state,
            "storage_mode": storage_mode,
            "nebius_ai": "configured" if llm.api_key() else "missing key",
        },
    }


async def _storage_state() -> tuple[str, str]:
    store = accounts.store
    if store is None:
        return "none", "not configured"
    if isinstance(store, accounts.FileStore):
        return "local", "connected"
    try:
        await asyncio.wait_for(store.get("nova:health"), STORAGE_PROBE_SECONDS)
    except Exception:
        return "redis", "unreachable"
    return "redis", "connected"
