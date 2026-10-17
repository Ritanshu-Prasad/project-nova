import logging
import os

from fastapi import HTTPException, Request

import shared
import usage

logger = logging.getLogger("nova.limits")


class RateLimiter:
    """Allows `calls` requests per client in each window of `seconds`; use it as a route dependency."""

    def __init__(self, name: str, calls: int, seconds: int):
        self.name = name
        self.calls = calls
        self.seconds = seconds

    async def __call__(self, request: Request) -> None:
        if os.getenv("NOVA_RATE_LIMIT") == "off":
            return
        key = f"nova:limit:{self.name}:{client_ip(request)}"
        try:
            count = await shared.state.hit(key, self.seconds)
            if count > self.calls:
                await usage.record_event(f"limit_denied:{self.name}")
                raise HTTPException(429, "Too many requests, try again later", headers={"Retry-After": str(await shared.state.ttl(key) or self.seconds)})
        except shared.StateError as error:
            logger.warning("Rate limit skipped, shared state unavailable: %s", error)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if os.getenv("TRUST_PROXY_HEADERS", "").lower() == "true" and forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# --- Limits per route ---

COURSE_LIMIT = RateLimiter("course", calls=20, seconds=3600)
TOPIC_LIMIT = RateLimiter("topic", calls=200, seconds=3600)
TUTOR_LIMIT = RateLimiter("tutor", calls=60, seconds=60)
FEEDBACK_LIMIT = RateLimiter("feedback", calls=60, seconds=3600)
