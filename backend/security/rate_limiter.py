"""security/rate_limiter.py - In-memory sliding-window log rate limiter."""
import os
import time
from collections import defaultdict

from fastapi import HTTPException, Request


class SlidingWindowRateLimiter:
    """FastAPI dependency: at most `max_requests` per `window_seconds` per client."""

    def __init__(self, max_requests: int, window_seconds: float, name: str = "rate_limit") -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.name = name
        self._history: dict[str, list[float]] = defaultdict(list)

    def _client_key(self, request: Request) -> str:
        sub = request.cookies.get("nova_session") or ""
        if sub:
            return f"{self.name}:session:{sub[:16]}"
        ip = request.client.host if request.client else "unknown"
        return f"{self.name}:ip:{ip}"

    async def __call__(self, request: Request) -> None:
        if os.getenv("NOVA_RATE_LIMIT") == "off":
            return
        now = time.time()
        key = self._client_key(request)
        cutoff = now - self.window_seconds
        history = [t for t in self._history[key] if t > cutoff]
        if len(history) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - history[0])) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: max {self.max_requests} requests per {int(self.window_seconds)}s.",
                headers={"Retry-After": str(max(1, retry_after))},
            )
        history.append(now)
        self._history[key] = history
        if len(self._history) > 5000:  # memory hygiene
            for k in list(self._history):
                self._history[k] = [t for t in self._history[k] if t > cutoff]
                if not self._history[k]:
                    self._history.pop(k, None)
