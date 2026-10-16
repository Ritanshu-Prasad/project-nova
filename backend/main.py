import json
import os
import uuid
from typing import List, Literal

import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # sibling modules on serverless runtimes too
from accounts import router as accounts_router  # noqa: E402
from fleet import router as fleet_router  # noqa: E402
from generator import router as generator_router  # noqa: E402

app = FastAPI(title="Project Nova API")
app.include_router(accounts_router)
app.include_router(fleet_router)
app.include_router(generator_router)

# Allow requests from our Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads/avatars"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Serve the uploaded files statically so the frontend can display them
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"status": "System Online", "service": "Project Nova API"}

AVATAR_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
AVATAR_MAX_BYTES = 5 * 1024 * 1024


async def _store_avatar(file: UploadFile, prefix: str) -> dict:
    """Saves an avatar under a random name (never the client's filename) — images only, up to 5 MB.
    Note: on Vercel the disk is not permanent; the app itself keeps avatars inside the pilot profile."""
    ext = AVATAR_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(415, "Avatar must be a PNG, JPEG, WebP or GIF image")
    data = await file.read(AVATAR_MAX_BYTES + 1)
    if len(data) > AVATAR_MAX_BYTES:
        raise HTTPException(413, "Avatar is larger than 5 MB")
    filename = f"{prefix}{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as buffer:
        buffer.write(data)
    return {"status": "success", "filename": filename, "url": f"/uploads/avatars/{filename}"}


@app.post("/api/users/avatar/upload")
async def upload_avatar(file: UploadFile = File(...)):
    """An uploaded image for a user's avatar."""
    return await _store_avatar(file, "")


@app.post("/api/users/avatar/doodle")
async def upload_doodle(file: UploadFile = File(...)):
    """A drawn doodle avatar (sent as an image file)."""
    return await _store_avatar(file, "doodle_")

# ---------------------------------------------------------------------------
# AI tutor — the lesson assistant in the study screen's side panel.
# Streams answers from an OpenAI-compatible endpoint (Nebius AI Studio by default).
#   NEBIUS_API_KEY     required; without it the endpoint returns 503 and the app uses its offline tutor
#   NEBIUS_BASE_URL    default https://api.tokenfactory.nebius.com/v1
#   NOVA_TUTOR_MODEL   default meta-llama/Llama-3.3-70B-Instruct (any chat model on the endpoint works)
# ---------------------------------------------------------------------------

NEBIUS_BASE_URL = os.getenv("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.com/v1").rstrip("/")
TUTOR_MODEL = os.getenv("NOVA_TUTOR_MODEL", "meta-llama/Llama-3.3-70B-Instruct")

TUTOR_PROMPT = """You are NOVA, a friendly AI tutor inside a space-themed learning app.
The learner is studying "{topic}" (module "{module}" of the course "{course}"). Their rank is {rank}.

Lesson content (your main source of truth):
---
{lesson}
---

How to answer:
- Help the learner understand THIS lesson. Prefer the lesson's own terms, examples and formulas.
- Be encouraging and concise: short paragraphs or bullet lists, usually under 150 words.
- Use `backticks` for formulas and code. Do not use LaTeX.
- If asked to quiz them, this is the Practice Arena: write NEW questions of your own from the lesson — never reuse
  or reword the course's graded questions listed below. Ask one question at a time (multiple choice with options
  A–D, or a short answer), wait for their reply, then say whether it is right and explain why in a sentence or two.
  Practice answers earn no MMR, so it is a safe place to try.
- If a question is off-topic, answer briefly and steer back to the lesson.{avoid}"""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class TutorContext(BaseModel):
    course: str = ""
    module: str = ""
    topic: str = ""
    lesson: str = ""
    rank: str = ""
    # The course's graded questions for this topic — the Practice Arena must not reuse them.
    avoid: List[str] = Field(default_factory=list, max_length=60)


class TutorRequest(BaseModel):
    messages: List[ChatMessage]
    context: TutorContext


def _avoid_block(questions: List[str]) -> str:
    """The graded questions the Practice Arena must not reuse, appended to the system prompt."""
    if not questions:
        return ""
    listed = "\n".join(f"- {q[:200]}" for q in questions[:40])
    return f"\n\nGraded questions (do not ask these or close variants):\n{listed}"


@app.post("/api/tutor/chat")
async def tutor_chat(req: TutorRequest):
    key = os.getenv("NEBIUS_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Tutor model is not configured")
    if not req.messages or req.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must come from the user")

    c = req.context
    system = TUTOR_PROMPT.format(
        topic=c.topic or "this topic",
        module=c.module or "-",
        course=c.course or "-",
        rank=c.rank or "new pilot",
        lesson=c.lesson[:8000],
        avoid=_avoid_block(c.avoid),
    )
    messages = [{"role": "system", "content": system}] + [m.model_dump() for m in req.messages[-12:]]

    client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    upstream = await client.send(
        client.build_request(
            "POST",
            f"{NEBIUS_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": TUTOR_MODEL, "messages": messages, "stream": True, "temperature": 0.4, "max_tokens": 700},
        ),
        stream=True,
    )
    if upstream.status_code != 200:
        await upstream.aread()
        await upstream.aclose()
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Model endpoint responded {upstream.status_code}")

    async def relay():
        # Server-sent events from the model → plain text chunks for the app.
        try:
            async for line in upstream.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content")
                except (ValueError, KeyError, IndexError):
                    continue
                if delta:
                    yield delta
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(relay(), media_type="text/plain; charset=utf-8")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
