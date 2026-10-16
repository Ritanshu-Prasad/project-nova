import os
import time


class TtlCache:
    """Remembers results for a while, so repeated requests do not pay for the model again."""

    def __init__(self, ttl_seconds: int, max_items: int):
        self.ttl_seconds = ttl_seconds
        self.max_items = max_items
        self.items: dict = {}

    def get(self, key):
        if os.getenv("NOVA_CACHE") == "off":
            return None
        expires, value = self.items.get(key, (0, None))
        if expires > time.monotonic():
            return value
        self.items.pop(key, None)
        return None

    def set(self, key, value) -> None:
        if len(self.items) >= self.max_items:
            self.items.pop(next(iter(self.items)))
        self.items[key] = (time.monotonic() + self.ttl_seconds, value)

    def clear(self) -> None:
        self.items.clear()


# --- Caches ---

COURSES = TtlCache(ttl_seconds=3600, max_items=200)
TOPICS = TtlCache(ttl_seconds=3600, max_items=1000)
ALL_CACHES = [COURSES, TOPICS]
