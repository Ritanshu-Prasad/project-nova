import logging
import os
import time

import httpx

logger = logging.getLogger("nova.shared")

MAX_LOCAL_KEYS = 10_000


class StateError(Exception):
    """The shared store could not be reached; callers carry on without it."""


# --- In memory (local development, tests) ---

class MemoryState:
    def __init__(self):
        self.entries: dict[str, tuple[float, str]] = {}
        self.hashes: dict[str, tuple[float, dict[str, int]]] = {}
        self.lists: dict[str, tuple[float, list[str]]] = {}

    async def hit(self, key: str, window_seconds: int) -> int:
        """Counts a request in a fixed window and returns how many have been counted in it."""
        return await self.add(key, 1, window_seconds)

    async def add(self, key: str, amount: int, window_seconds: int) -> int:
        """Adds to a counter that starts again when its window ends, and returns the new total."""
        now = time.monotonic()
        entry = self.entries.get(key)
        if entry is None or entry[0] <= now:
            expires, total = now + window_seconds, amount
        else:
            expires, total = entry[0], int(entry[1]) + amount
        self._store(key, expires, str(total))
        return total

    async def ttl(self, key: str) -> int:
        entry = self.entries.get(key)
        return max(0, int(entry[0] - time.monotonic())) if entry else 0

    async def get(self, key: str) -> str | None:
        return self._live(key, time.monotonic())

    async def put(self, key: str, value: str, ttl_seconds: int) -> None:
        self._store(key, time.monotonic() + ttl_seconds, value)

    async def delete(self, key: str) -> None:
        self.entries.pop(key, None)

    async def hincr_many(self, key: str, amounts: dict[str, int], ttl_seconds: int) -> None:
        """Adds to several named counters kept together under one key, which expires `ttl_seconds` after the first write."""
        now = time.monotonic()
        expires, fields = self.hashes.get(key, (0.0, {}))
        if expires <= now:
            expires, fields = now + ttl_seconds, {}
        for name, amount in amounts.items():
            fields[name] = fields.get(name, 0) + amount
        self.hashes[key] = (expires, fields)

    async def hgetall(self, key: str) -> dict[str, int]:
        expires, fields = self.hashes.get(key, (0.0, {}))
        return dict(fields) if expires > time.monotonic() else {}

    async def push_capped(self, key: str, value: str, max_items: int, ttl_seconds: int) -> None:
        """Puts a value at the front of a list that keeps only its `max_items` newest and expires `ttl_seconds` after the first write."""
        now = time.monotonic()
        expires, items = self.lists.get(key, (0.0, []))
        if expires <= now:
            expires, items = now + ttl_seconds, []
        self.lists[key] = (expires, [value, *items][:max_items])

    async def recent(self, key: str, count: int) -> list[str]:
        """The newest `count` values of a list, newest first."""
        expires, items = self.lists.get(key, (0.0, []))
        return items[:count] if expires > time.monotonic() else []

    def clear(self) -> None:
        self.entries.clear()
        self.hashes.clear()
        self.lists.clear()

    def _live(self, key: str, now: float) -> str | None:
        entry = self.entries.get(key)
        if entry is None:
            return None
        if entry[0] <= now:
            del self.entries[key]
            return None
        return entry[1]

    def _store(self, key: str, expires: float, value: str) -> None:
        if len(self.entries) >= MAX_LOCAL_KEYS:
            self._forget_expired()
        self.entries[key] = (expires, value)

    def _forget_expired(self) -> None:
        now = time.monotonic()
        for key in [key for key, (expires, _) in self.entries.items() if expires <= now]:
            del self.entries[key]


# --- Upstash Redis over its REST API (serverless deployments) ---

class RedisState:
    def __init__(self, url: str, token: str):
        self.url = url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"}

    async def hit(self, key: str, window_seconds: int) -> int:
        return await self.add(key, 1, window_seconds)

    async def add(self, key: str, amount: int, window_seconds: int) -> int:
        total = int(await self._cmd("INCRBY", key, str(amount)))
        if total == amount:
            await self._cmd("EXPIRE", key, str(window_seconds))
        return total

    async def ttl(self, key: str) -> int:
        return max(0, int(await self._cmd("TTL", key)))

    async def get(self, key: str) -> str | None:
        return await self._cmd("GET", key)

    async def put(self, key: str, value: str, ttl_seconds: int) -> None:
        await self._cmd("SET", key, value, "EX", str(ttl_seconds))

    async def delete(self, key: str) -> None:
        await self._cmd("DEL", key)

    async def hincr_many(self, key: str, amounts: dict[str, int], ttl_seconds: int) -> None:
        commands = [["HINCRBY", key, name, str(amount)] for name, amount in amounts.items()] + [["EXPIRE", key, str(ttl_seconds), "NX"]]
        await self._post(f"{self.url}/pipeline", commands)

    async def hgetall(self, key: str) -> dict[str, int]:
        flat = await self._cmd("HGETALL", key) or []
        return {name: int(value) for name, value in zip(flat[::2], flat[1::2])}

    async def push_capped(self, key: str, value: str, max_items: int, ttl_seconds: int) -> None:
        await self._post(f"{self.url}/pipeline", [["LPUSH", key, value], ["LTRIM", key, "0", str(max_items - 1)], ["EXPIRE", key, str(ttl_seconds), "NX"]])

    async def recent(self, key: str, count: int) -> list[str]:
        return await self._cmd("LRANGE", key, "0", str(count - 1)) or []

    async def _cmd(self, *args: str):
        return (await self._post(self.url, list(args))).get("result")

    async def _post(self, url: str, body: list):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.post(url, headers=self.headers, json=body)
        except httpx.HTTPError as error:
            raise StateError(str(error))
        if response.status_code != 200:
            raise StateError(f"Redis answered {response.status_code}")
        return response.json()


# --- Which one ---

def make_state() -> MemoryState | RedisState:
    raw_url = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL") or ""
    raw_token = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN") or ""
    url = raw_url.strip().strip('"\'').rstrip("/")
    token = raw_token.strip().strip('"\'')
    return RedisState(url, token) if url and token else MemoryState()


state = make_state()
