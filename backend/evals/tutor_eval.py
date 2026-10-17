import asyncio
import io
import re

import httpx
from fastapi import FastAPI, UploadFile

import tutor
from document_store import save_pages
from evals import cases, rows
from evals.judge import answered_off_topic
from evals.metrics import fraction
from evals.pdfs import make_pdf
from pdf_parser import read_documents
from spoilers import find_clash


def client() -> httpx.AsyncClient:
    """The real tutor route, called in-process."""
    app = FastAPI()
    app.include_router(tutor.router)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://eval", timeout=120)


async def ask(http: httpx.AsyncClient, message: str, context: dict) -> str:
    response = await http.post("/api/tutor/chat", json={"messages": [{"role": "user", "content": message}], "context": context})
    return response.text if response.status_code == 200 else ""


# --- Practice questions must not be the graded ones ---

async def spoiler(http: httpx.AsyncClient, case: dict, message: str) -> dict:
    row = rows.start("tutor", check="spoiler", case=case["id"], message=message)
    context = {"topic": case["topic"], "lesson": case["lesson"], "avoid": case["graded"]}
    reply = await ask(http, message, context)
    clash = find_clash(reply, case["graded"])
    row.update(ok=clash is None, reply=reply[:300], clash=clash, empty=not reply)
    return rows.finish(row)


# --- Unrelated questions must be declined ---

async def off_topic(http: httpx.AsyncClient, case: dict, question: str) -> dict:
    row = rows.start("tutor", check="off_topic", case=case["id"], message=question)
    reply = await ask(http, question, {"topic": case["topic"], "lesson": case["lesson"]})
    row.update(ok=bool(reply) and not await answered_off_topic(question, reply), reply=reply[:300])
    return rows.finish(row)


# --- Questions about the learner's documents ---

async def grounded(http: httpx.AsyncClient, key: str, fact: dict, setup: dict, check: str) -> dict:
    """With the documents key the tutor should find the fact and its page; without it (the control) it should not."""
    row = rows.start("tutor", check=check, case=fact["question"][:40])
    reply = await ask(http, fact["question"], {"topic": setup["topic"], "lesson": setup["lesson"], "documentsKey": key})
    found = all(word.lower() in reply.lower() for word in fact["keywords"])
    cites = bool(re.search(rf"\bp(?:age|p?\.)?\s*{fact['page']}\b", reply, re.IGNORECASE))
    row.update(ok=found, cites_page=cites, reply=reply[:300])
    return rows.finish(row)


async def kept_documents(setup: dict) -> str | None:
    document = setup["document"]
    upload = UploadFile(file=io.BytesIO(make_pdf(document["pages"])), filename=document["name"])
    return await save_pages(await read_documents([upload]))


# --- The suite ---

async def run(which: str) -> list[dict]:
    plan = cases.load("tutor")
    smoke = which == "smoke"
    spoilers = plan["spoilers"][:1] if smoke else plan["spoilers"]
    requests = plan["quiz_requests"][:2] if smoke else plan["quiz_requests"]
    repeats = 1 if smoke else plan["repeats"]
    unrelated = plan["off_topic"][:2] if smoke else plan["off_topic"]
    setup = plan["grounded"]
    key = await kept_documents(setup)
    async with client() as http:
        jobs = [spoiler(http, case, message) for case in spoilers for message in requests for _ in range(repeats)]
        jobs += [off_topic(http, plan["spoilers"][0], question) for question in unrelated]
        jobs += [grounded(http, key or "", fact, setup, "grounded") for fact in setup["facts"]]
        jobs += [grounded(http, "", fact, setup, "ungrounded") for fact in setup["facts"]]
        return list(await asyncio.gather(*jobs))


def summarise(result_rows: list[dict]) -> dict:
    by = lambda check: [row for row in result_rows if row["check"] == check]
    pages = [row for row in by("grounded") if row["ok"]]
    return {
        "runs": len(result_rows),
        "spoiler_rate": fraction(by("spoiler"), lambda row: not row["ok"]),
        "off_topic_refusal_rate": fraction(by("off_topic"), lambda row: row["ok"]),
        "grounded_rate": fraction(by("grounded"), lambda row: row["ok"]),
        "grounded_page_rate": fraction(pages, lambda row: row["cites_page"]),
        "ungrounded_rate": fraction(by("ungrounded"), lambda row: row["ok"]),
    }
