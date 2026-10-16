import asyncio
import os
import re
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import calibration  # noqa: E402
import document_store  # noqa: E402
import generator  # noqa: E402
import llm  # noqa: E402
import shared  # noqa: E402
from evals.pdfs import make_pdf  # noqa: E402,F401
from samples import lesson_json, mcq, module_json, outline_json, questions  # noqa: E402


def reply_for(system: str, call_number: int, user: str = "") -> dict:
    """A valid model answer for whichever prompt was sent; every question list has its own distinct questions."""
    if "review learning goals" in system:
        return {"allowed": True, "reason": ""}
    if "placement quiz" in system:
        return {"questions": [{**mcq(n), "difficulty": difficulty} for n, difficulty in enumerate([3, 1, 2, 1, 2])]}
    if "careful student" in system:
        return {"answers": [{"number": int(number), "choice": [1]} for number in re.findall(r"^Question (\d+)", user, re.MULTILINE)]}
    if "strict teaching reviewer" in system:
        return {"accuracy": 4, "clarity": 5, "level_fit": 4, "alignment": 5, "notes": "none"}
    if "Turn one part of a document" in system:
        return module_json()
    if "curriculum architect" in system:
        return outline_json()
    if "textbook author" in system:
        return lesson_json()
    count = int(re.search(r"exactly (\d+) questions", system).group(1))
    return {"questions": questions(count, start=call_number * 100)}


@pytest.fixture(autouse=True)
def fresh_limits(monkeypatch):
    """Every test starts with a fresh shared state (rate limits and caches), no waiting between model retries, no goal check and no answer check."""
    monkeypatch.setattr(shared, "state", shared.MemoryState())
    document_store._indexes.clear()
    monkeypatch.setattr(llm, "RETRY_DELAYS", ())
    monkeypatch.setenv("NOVA_MODERATION", "off")
    monkeypatch.setenv("NOVA_VERIFY_ANSWERS", "off")


@pytest.fixture
def fake_model(monkeypatch):
    """Replaces the model call. `calls` records every system prompt, `prompts` every (system, user) pair; set `replies` to script answers."""

    class Fake:
        calls: list = []
        prompts: list = []
        replies: list = []
        limits: list = []
        thinking: list = []
        kinds: list = []
        schemas: list = []

    fake = Fake()
    fake.calls, fake.prompts, fake.replies, fake.limits, fake.thinking, fake.kinds, fake.schemas = [], [], [], [], [], [], []

    async def chat_json(system: str, user: str, max_tokens: int = 0, thinking: bool = False, schema=None, kind: str = "call") -> dict:
        await asyncio.sleep(0)  # like a real request, other calls get to start while this one waits
        fake.limits.append(max_tokens)
        fake.thinking.append(thinking)
        fake.kinds.append(kind)
        fake.schemas.append(schema)
        fake.calls.append(system)
        fake.prompts.append((system, user))
        reply = fake.replies.pop(0) if fake.replies else reply_for(system, len(fake.calls), user)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(llm, "chat_json", chat_json)
    return fake


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(generator.router)
    app.include_router(calibration.router)
    return TestClient(app)


@pytest.fixture
def pdf():
    return make_pdf
