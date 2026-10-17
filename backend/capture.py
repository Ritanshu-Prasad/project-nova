import json
import logging
import os
import time
from pathlib import Path

from request_context import request_id_var

logger = logging.getLogger("nova.capture")

FILE = Path(__file__).parent / ".data" / "prompts.jsonl"
MAX_CHARS = 2000


def enabled() -> bool:
    """Saving prompts keeps what learners typed, so it is for local debugging only and never on a hosted deployment."""
    return os.getenv("NOVA_LOG_PROMPTS") == "on" and not os.getenv("VERCEL")


def save_exchange(kind: str, system: str, user: str, reply: str, tokens: dict | None) -> None:
    if not enabled():
        return
    line = {"time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "request_id": request_id_var.get(), "kind": kind, "tokens": tokens,
            "system": system[:MAX_CHARS], "user": user[:MAX_CHARS], "reply": reply[:MAX_CHARS]}
    try:
        FILE.parent.mkdir(parents=True, exist_ok=True)
        with FILE.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(line, ensure_ascii=False) + "\n")
    except OSError as error:
        logger.warning("Prompt not saved: %s", error)
