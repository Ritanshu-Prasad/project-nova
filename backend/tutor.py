import json
import logging
import time
from typing import AsyncIterator, List, Literal

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import llm
from prompts import GRADED_REMINDER, sanitise, tutor_system

router = APIRouter()
logger = logging.getLogger("nova.tutor")

TIMEOUT = httpx.Timeout(60.0, connect=10.0)
HISTORY_MESSAGES = 12
LESSON_CHARS = 8000
GRADED_SHOWN = 40
GRADED_CHARS = 200
LABEL_CHARS = 200
STREAM_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


# --- Request ---

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class TutorContext(BaseModel):
    course: str = ""
    module: str = ""
    topic: str = ""
    lesson: str = ""
    rank: str = ""
    # The course's graded questions for this topic; the Practice Arena must not reuse them.
    avoid: List[str] = Field(default_factory=list, max_length=60)


class TutorRequest(BaseModel):
    messages: List[ChatMessage]
    context: TutorContext


# --- Route ---

@router.post("/api/tutor/chat")
async def tutor_chat(body: TutorRequest):
    if not llm.api_key():
        raise HTTPException(503, "Tutor model is not configured")
    if not body.messages or body.messages[-1].role != "user":
        raise HTTPException(422, "The last message must come from the user")

    messages = [{"role": "system", "content": _system_prompt(body.context)}] + _history(body)
    client = httpx.AsyncClient(timeout=TIMEOUT)
    upstream = await _open_stream(client, messages)
    return StreamingResponse(_relay(upstream, client), media_type="text/plain; charset=utf-8", headers=STREAM_HEADERS)


def _history(body: TutorRequest) -> list:
    history = [message.model_dump() for message in body.messages[-HISTORY_MESSAGES:]]
    if body.context.avoid:
        history[-1]["content"] += f"\n\n{GRADED_REMINDER}"
    return history


def _system_prompt(context: TutorContext) -> str:
    return tutor_system(
        topic=sanitise(context.topic, LABEL_CHARS) or "this topic",
        module=sanitise(context.module, LABEL_CHARS) or "-",
        course=sanitise(context.course, LABEL_CHARS) or "-",
        rank=sanitise(context.rank, LABEL_CHARS) or "new pilot",
        lesson=context.lesson[:LESSON_CHARS],
        graded=[question[:GRADED_CHARS] for question in context.avoid[:GRADED_SHOWN]],
    )


# --- Streaming ---

async def _open_stream(client: httpx.AsyncClient, messages: list) -> httpx.Response:
    payload = {"model": llm.tutor_model(), "messages": messages, "stream": True, "temperature": 0.4, "max_tokens": 700}
    request = client.build_request("POST", f"{llm.base_url()}/chat/completions", headers={"Authorization": f"Bearer {llm.api_key()}"}, json=payload)
    try:
        upstream = await client.send(request, stream=True)
        if upstream.status_code != 200:
            await upstream.aread()
            await upstream.aclose()
            llm.raise_for_upstream(upstream)
    except httpx.HTTPError as error:
        logger.warning("Tutor model request failed: %s", error)
        await client.aclose()
        raise HTTPException(502, "Could not reach the tutor model")
    except HTTPException:
        await client.aclose()
        raise
    return upstream


async def _relay(upstream: httpx.Response, client: httpx.AsyncClient) -> AsyncIterator[str]:
    """Model server-sent events as plain text chunks; a dropped connection simply ends the answer."""
    started = time.perf_counter()
    first = True
    try:
        async for line in upstream.aiter_lines():
            text = _delta(line)
            if not text:
                continue
            if first:
                logger.info("Tutor first token after %.0f ms", (time.perf_counter() - started) * 1000)
                first = False
            yield text
    except httpx.HTTPError as error:
        logger.warning("Tutor stream ended early: %s", error)
    finally:
        await upstream.aclose()
        await client.aclose()


def _delta(line: str) -> str | None:
    if not line.startswith("data:"):
        return None
    try:
        return json.loads(line[5:])["choices"][0]["delta"].get("content")
    except (ValueError, KeyError, IndexError, TypeError):
        return None
