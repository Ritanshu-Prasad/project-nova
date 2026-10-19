import os
import uuid

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # sibling modules on serverless runtimes too
from accounts import router as accounts_router  # noqa: E402
from admin import router as admin_router  # noqa: E402
from calibration import router as calibration_router  # noqa: E402
from fleet import router as fleet_router  # noqa: E402
from generator import router as generator_router  # noqa: E402
from observability import add_request_logging, configure_logging, log_startup, router as health_router  # noqa: E402
from tutor import router as tutor_router  # noqa: E402

configure_logging()
log_startup()
app = FastAPI(title="Project Nova API")
add_request_logging(app)
app.include_router(health_router)
app.include_router(accounts_router)
app.include_router(admin_router)
app.include_router(calibration_router)
app.include_router(fleet_router)
app.include_router(generator_router)
app.include_router(tutor_router)

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
