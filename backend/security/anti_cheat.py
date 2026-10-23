"""security/anti_cheat.py - Concurrency lock, throttle and delta clamping."""
import asyncio
import re
import time

from fastapi import HTTPException

HTML_CHARS = re.compile(r"[\x00-\x1f\x7f<>&\"']")


class ScoreConcurrencyGuard:
    """Entity-agnostic guard for score read-modify-write operations."""

    def __init__(self, throttle_seconds: float = 5.0, max_delta: int = 5000, max_initial: int = 50000) -> None:
        self.throttle_seconds = throttle_seconds
        self.max_delta = max_delta
        self.max_initial = max_initial
        self._lock = asyncio.Lock()
        self._last_submissions: dict[str, float] = {}

    def sanitize_string(self, text: str, max_len: int) -> str:
        """Remove control and HTML-significant chars, trim, cap length."""
        return HTML_CHARS.sub("", str(text or "")).strip()[:max_len]

    def check_throttle(self, entity_id: str) -> None:
        """Raise 429 if `entity_id` submitted within the throttle window."""
        now = time.time()
        if now - self._last_submissions.get(entity_id, 0.0) < self.throttle_seconds:
            raise HTTPException(429, f"Submitting too fast; please wait {int(self.throttle_seconds)} seconds")
        self._last_submissions[entity_id] = now

    def clamp_delta(self, old_xp: int | None, new_xp: int) -> int:
        """Never decrease; cap increase at max_delta (first score capped at max_initial)."""
        if old_xp is None:
            return min(new_xp, self.max_initial)
        if new_xp < old_xp:
            return old_xp
        return min(new_xp, old_xp + self.max_delta)

    @property
    def lock(self) -> asyncio.Lock:
        """Lock to wrap load-modify-store sequences."""
        return self._lock
