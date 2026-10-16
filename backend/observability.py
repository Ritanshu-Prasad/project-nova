import asyncio
import logging
import os
import re
import time
import uuid
from contextvars import ContextVar

from fastapi import APIRouter, FastAPI, Request

import accounts
import llm
import usage

router = APIRouter()
logger = logging.getLogger("nova.requests")

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
STARTED = time.time()
STORAGE_PROBE_SECONDS = 3


# --- Logging ---

class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def configure_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(level=level, format="%(asctime)s [%(levelname)s] [%(name)s] [%(request_id)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    for handler in logging.getLogger().handlers:
        handler.addFilter(RequestIdFilter())


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
            logger.info("%s %s -> %s (%.0f ms)%s", request.method, request.url.path, response.status_code, elapsed, cost)
            return response
        finally:
            request_id_var.reset(token)


# --- Health ---

@router.get("/api/health")
async def health():
    storage_mode, storage_state = await _storage_state()
    return {
        "status": "healthy" if storage_state != "unreachable" else "degraded",
        "timestamp": int(time.time() * 1000),
        "uptime_seconds": round(time.time() - STARTED, 1),
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
