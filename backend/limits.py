import os
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

MAX_TRACKED_CLIENTS = 10_000


class RateLimiter:
    """Allows `calls` requests per client within `seconds`; use it as a route dependency."""

    def __init__(self, calls: int, seconds: int):
        self.calls = calls
        self.seconds = seconds
        self.hits: dict[str, deque] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        if os.getenv("NOVA_RATE_LIMIT") == "off":
            return
        now = time.monotonic()
        hits = self._recent(client_ip(request), now)
        if len(hits) >= self.calls:
            wait = int(self.seconds - (now - hits[0])) + 1
            raise HTTPException(429, "Too many requests, try again later", headers={"Retry-After": str(wait)})
        hits.append(now)

    def clear(self) -> None:
        self.hits.clear()

    def _recent(self, client: str, now: float) -> deque:
        if len(self.hits) > MAX_TRACKED_CLIENTS:
            self._forget_idle(now)
        hits = self.hits[client]
        while hits and now - hits[0] > self.seconds:
            hits.popleft()
        return hits

    def _forget_idle(self, now: float) -> None:
        idle = [client for client, hits in self.hits.items() if not hits or now - hits[-1] > self.seconds]
        for client in idle:
            del self.hits[client]


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if os.getenv("TRUST_PROXY_HEADERS", "").lower() == "true" and forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# --- Limits per route ---

COURSE_LIMIT = RateLimiter(calls=20, seconds=3600)
TOPIC_LIMIT = RateLimiter(calls=200, seconds=3600)
TUTOR_LIMIT = RateLimiter(calls=60, seconds=60)
ALL_LIMITS = [COURSE_LIMIT, TOPIC_LIMIT, TUTOR_LIMIT]
