import hashlib
import json
import logging
import os

import llm
import shared
import usage
from prompts import PROMPT_VERSION

logger = logging.getLogger("nova.cache")


class ResultCache:
    """Remembers finished results for a while, so repeated requests do not pay for the model again.

    Keys include the prompt version and the model, so a change to either never serves old content.
    """

    def __init__(self, name: str, ttl_seconds: int):
        self.name = name
        self.ttl_seconds = ttl_seconds

    async def get(self, parts: tuple) -> dict | None:
        if os.getenv("NOVA_CACHE") == "off":
            return None
        try:
            stored = await shared.state.get(self._key(parts))
        except shared.StateError as error:
            logger.warning("Cache read skipped: %s", error)
            return None
        await usage.record_event(f"cache:{self.name}:{'hit' if stored else 'miss'}")
        return json.loads(stored) if stored else None

    async def put(self, parts: tuple, value: dict) -> None:
        try:
            await shared.state.put(self._key(parts), json.dumps(value), self.ttl_seconds)
        except shared.StateError as error:
            logger.warning("Cache write skipped: %s", error)

    def _key(self, parts: tuple) -> str:
        fingerprint = json.dumps([PROMPT_VERSION, llm.generate_model(), *parts])
        return f"nova:cache:{self.name}:{hashlib.sha1(fingerprint.encode()).hexdigest()}"


# --- Caches ---

COURSES = ResultCache("course", ttl_seconds=3600)
TOPICS = ResultCache("topic", ttl_seconds=3600)
BANKS = ResultCache("bank", ttl_seconds=7 * 24 * 3600)
