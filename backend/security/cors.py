"""security/cors.py - Fail-closed CORS configuration."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

DEFAULT_DEV_ORIGINS: list[str] = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000",
]
ALLOWED_METHODS: list[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
ALLOWED_HEADERS: list[str] = ["Content-Type", "X-Nova", "Authorization", "Accept", "Origin"]


def configure_cors(app: FastAPI) -> None:
    """Attach CORSMiddleware with explicit origins/methods/headers (never a wildcard)."""
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()] or DEFAULT_DEV_ORIGINS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=ALLOWED_METHODS,
        allow_headers=ALLOWED_HEADERS,
        expose_headers=["Retry-After"],
        max_age=3600,
    )
