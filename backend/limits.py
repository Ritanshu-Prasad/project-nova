import logging
import os

from fastapi import HTTPException, Request

import accounts
import shared
import usage

logger = logging.getLogger("nova.limits")


class RateLimiter:
    """Allows `calls` requests per signed-in pilot, or `anonymous_calls` per address, in each window of `seconds`; use it as a route dependency."""

    def __init__(self, name: str, calls: int, seconds: int, anonymous_calls: int | None = None):
        self.name = name
        self.calls = calls
        self.seconds = seconds
        self.anonymous_calls = anonymous_calls if anonymous_calls is not None else calls

    async def __call__(self, request: Request) -> None:
        if os.getenv("NOVA_RATE_LIMIT") == "off":
            return
        sub = accounts.signed_in_sub(request)
        key = f"nova:limit:{self.name}:{sub or client_ip(request)}"
        allowed = self.calls if sub else self.anonymous_calls
        try:
            count = await shared.state.hit(key, self.seconds)
            if count > allowed:
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

COURSE_LIMIT = RateLimiter("course", calls=20, seconds=3600, anonymous_calls=6)
TOPIC_LIMIT = RateLimiter("topic", calls=200, seconds=3600, anonymous_calls=60)
TUTOR_LIMIT = RateLimiter("tutor", calls=60, seconds=60, anonymous_calls=20)
FEEDBACK_LIMIT = RateLimiter("feedback", calls=60, seconds=3600)
