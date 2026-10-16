import io
import os
import re
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import generator  # noqa: E402
import limits  # noqa: E402
import llm  # noqa: E402
from samples import lesson_json, module_json, outline_json, questions  # noqa: E402


def make_pdf(pages, bookmarks=None) -> bytes:
    """A small PDF: `pages` is a text (or list of texts, one per page); `bookmarks` is a list of (title, page number)."""
    pages = [pages] if isinstance(pages, str) else pages
    bookmarks = bookmarks or []
    first_page = 4
    outline_root = first_page + 2 * len(pages)
    objects = {
        1: f"<</Type/Catalog/Pages 2 0 R{f' /Outlines {outline_root} 0 R' if bookmarks else ''}>>",
        2: f"<</Type/Pages/Kids[{' '.join(f'{first_page + 2 * i} 0 R' for i in range(len(pages)))}]/Count {len(pages)}>>",
        3: "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    }
    for i, text in enumerate(pages):
        lines = " 0 -14 Td ".join(f"({line}) Tj" for line in text.split("\n"))
        stream = f"BT /F1 12 Tf 50 700 Td {lines} ET"
        objects[first_page + 2 * i] = f"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents {first_page + 2 * i + 1} 0 R/Resources<</Font<</F1 3 0 R>>>>>>"
        objects[first_page + 2 * i + 1] = f"<</Length {len(stream)}>>\nstream\n{stream}\nendstream"
    if bookmarks:
        item = lambda j: outline_root + 1 + j
        objects[outline_root] = f"<</Type/Outlines/First {item(0)} 0 R/Last {item(len(bookmarks) - 1)} 0 R/Count {len(bookmarks)}>>"
        for j, (title, number) in enumerate(bookmarks):
            links = (f" /Prev {item(j - 1)} 0 R" if j else "") + (f" /Next {item(j + 1)} 0 R" if j < len(bookmarks) - 1 else "")
            objects[item(j)] = f"<</Title ({title}) /Parent {outline_root} 0 R /Dest [{first_page + 2 * (number - 1)} 0 R /Fit]{links}>>"
    out = io.StringIO()
    out.write("%PDF-1.4\n")
    offsets = {}
    for number in sorted(objects):
        offsets[number] = out.tell()
        out.write(f"{number} 0 obj\n{objects[number]}\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n")
    out.writelines(f"{offsets[number]:010d} 00000 n \n" for number in sorted(objects))
    out.write(f"trailer\n<</Size {len(objects) + 1}/Root 1 0 R>>\nstartxref\n{xref}\n%%EOF")
    return out.getvalue().encode()


def reply_for(system: str, call_number: int) -> dict:
    """A valid model answer for whichever prompt was sent; every question list has its own distinct questions."""
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
    """Every test starts with empty rate limits and no waiting between model retries."""
    for limit in limits.ALL_LIMITS:
        limit.clear()
    monkeypatch.setattr(llm, "RETRY_DELAYS", ())


@pytest.fixture
def fake_model(monkeypatch):
    """Replaces the model call. `calls` records every system prompt, `prompts` every (system, user) pair; set `replies` to script answers."""

    class Fake:
        calls: list = []
        prompts: list = []
        replies: list = []

    fake = Fake()
    fake.calls, fake.prompts, fake.replies = [], [], []

    async def chat_json(system: str, user: str) -> dict:
        fake.calls.append(system)
        fake.prompts.append((system, user))
        reply = fake.replies.pop(0) if fake.replies else reply_for(system, len(fake.calls))
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(llm, "chat_json", chat_json)
    return fake


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(generator.router)
    return TestClient(app)


@pytest.fixture
def pdf():
    return make_pdf
