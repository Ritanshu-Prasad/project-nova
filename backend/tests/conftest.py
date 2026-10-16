import io
import os
import re
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import generator  # noqa: E402
from samples import lesson_json, outline_json, questions  # noqa: E402


def make_pdf(text: str) -> bytes:
    stream = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET"
    objects = [
        "<</Type/Catalog/Pages 2 0 R>>",
        "<</Type/Pages/Kids[3 0 R]/Count 1>>",
        "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
        f"<</Length {len(stream)}>>\nstream\n{stream}\nendstream",
        "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]
    out = io.StringIO()
    out.write("%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{number} 0 obj\n{body}\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n")
    out.writelines(f"{offset:010d} 00000 n \n" for offset in offsets)
    out.write(f"trailer\n<</Size {len(objects) + 1}/Root 1 0 R>>\nstartxref\n{xref}\n%%EOF")
    return out.getvalue().encode()


def reply_for(system: str, call_number: int) -> dict:
    """A valid model answer for whichever prompt was sent; every question list has its own distinct questions."""
    if "curriculum architect" in system:
        return outline_json()
    if "textbook author" in system:
        return lesson_json()
    count = int(re.search(r"exactly (\d+) questions", system).group(1))
    return {"questions": questions(count, start=call_number * 100)}


@pytest.fixture
def fake_model(monkeypatch):
    """Replaces the model call. `calls` records every system prompt; set `replies` to script answers."""

    class Fake:
        calls: list = []
        replies: list = []

    fake = Fake()
    fake.calls, fake.replies = [], []

    async def chat_json(system: str, user: str) -> dict:
        fake.calls.append(system)
        reply = fake.replies.pop(0) if fake.replies else reply_for(system, len(fake.calls))
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(generator, "chat_json", chat_json)
    return fake


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(generator.router)
    return TestClient(app)


@pytest.fixture
def pdf():
    return make_pdf
