import json
import os
import shutil
from typing import List, Literal

import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(title="Project Nova API")

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

@app.post("/api/users/avatar/upload")
async def upload_avatar(file: UploadFile = File(...)):
    """
    Endpoint to handle uploading an image file for a user's avatar.
    """
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return the URL path where the frontend can fetch the image
    return {
        "status": "success",
        "filename": file.filename,
        "url": f"/uploads/avatars/{file.filename}"
    }

@app.post("/api/users/avatar/doodle")
async def upload_doodle(file: UploadFile = File(...)):
    """
    Endpoint to handle uploading a custom doodle (usually sent as a base64 blob converted to file).
    """
    filename = f"doodle_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "status": "success",
        "filename": filename,
        "url": f"/uploads/avatars/{filename}"
    }

# ---------------------------------------------------------------------------
# AI tutor — the lesson assistant in the study screen's side panel.
# Streams answers from an OpenAI-compatible endpoint (Nebius AI Studio by default).
#   NEBIUS_API_KEY     required; without it the endpoint returns 503 and the app uses its offline tutor
#   NEBIUS_BASE_URL    default https://api.studio.nebius.com/v1
#   NOVA_TUTOR_MODEL   default meta-llama/Llama-3.3-70B-Instruct (any chat model on the endpoint works)
# ---------------------------------------------------------------------------

NEBIUS_BASE_URL = os.getenv("NEBIUS_BASE_URL", "https://api.studio.nebius.com/v1").rstrip("/")
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
- If asked to quiz them, ask one question at a time and wait for their answer.
- If a question is off-topic, answer briefly and steer back to the lesson."""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class TutorContext(BaseModel):
    course: str = ""
    module: str = ""
    topic: str = ""
    lesson: str = ""
    rank: str = ""


class TutorRequest(BaseModel):
    messages: List[ChatMessage]
    context: TutorContext


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
