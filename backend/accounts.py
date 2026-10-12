"""
Pilot accounts: Google sign-in and a progress save per account.

  POST /api/auth/google   {"accessToken"}       verifies a Google access token and starts a session (HttpOnly cookie)
  GET  /api/auth/me                             the signed-in pilot and when their save was last written
  POST /api/auth/logout                         ends the session
  GET  /api/progress                            the pilot's saved progress
  PUT  /api/progress      {"savedAt", "base", "save"}  replaces it; "base" must be the savedAt it was made from (else 409)

Environment
  GOOGLE_CLIENT_ID      OAuth 2.0 web client ID — the same value the frontend gets as VITE_GOOGLE_CLIENT_ID
  SESSION_SECRET        long random string that signs session cookies (required in production)
  KV_REST_API_URL, KV_REST_API_TOKEN            Upstash Redis (Vercel Storage → Upstash for Redis sets these);
  or UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
                        without them accounts live in backend/.data/accounts.json — fine locally, not on Vercel
  NOVA_DEV_LOGIN=1      local testing only: enables POST /api/auth/dev {"email", "name"} (ignored on Vercel)
"""

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from typing import Any, Dict, List, Literal, Optional

router = APIRouter()

ON_VERCEL = bool(os.getenv("VERCEL"))
ENVIRONMENT = os.getenv("ENVIRONMENT", os.getenv("ENV", "development" if not ON_VERCEL else "production")).lower()
IS_PRODUCTION = ENVIRONMENT == "production" or ON_VERCEL
DEV_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

COOKIE = "nova_session"
SESSION_DAYS = 30
# Vercel functions accept request bodies up to 4.5 MB; leave headroom.
MAX_SAVE_BYTES = 4_000_000


# ── Storage ────────────────────────────────────────────────────────────────


class RedisStore:
    """Upstash Redis over its REST API (no extra dependency: httpx is already used by the tutor)."""

    def __init__(self, url: str, token: str):
        self.url = url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"}

    async def _cmd(self, *args: str):
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(self.url, headers=self.headers, json=list(args))
        if r.status_code != 200:
            raise HTTPException(502, "Account storage is unavailable")
        return r.json().get("result")

    async def get(self, key: str) -> str | None:
        return await self._cmd("GET", key)

    async def set(self, key: str, value: str) -> None:
        await self._cmd("SET", key, value)


class FileStore:
    """A JSON file for local development."""

    def __init__(self, path: Path):
        self.path = path
        self.lock = asyncio.Lock()

    def _read(self) -> dict:
        try:
            return json.loads(self.path.read_text("utf-8"))
        except (OSError, ValueError):
            return {}

    async def get(self, key: str) -> str | None:
        async with self.lock:
            return self._read().get(key)

    async def set(self, key: str, value: str) -> None:
        async with self.lock:
            data = self._read()
            data[key] = value
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data), "utf-8")
            tmp.replace(self.path)


def _make_store():
    url = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
    token = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")
    if url and token:
        return RedisStore(url, token)
    if ON_VERCEL:
        return None  # a file on a serverless function would silently lose saves
    return FileStore(Path(__file__).parent / ".data" / "accounts.json")


store = _make_store()


def _store():
    if store is None:
        raise HTTPException(503, "Account storage is not configured (add Upstash Redis to the Vercel project)")
    return store


def _user_key(sub: str) -> str:
    return f"nova:user:{sub}"


def _save_key(sub: str) -> str:
    return f"nova:save:{sub}"


# ── Sessions ───────────────────────────────────────────────────────────────


def _validate_session_secret_at_startup() -> None:
    """Fails fast on startup if production environment lacks a cryptographically sound secret."""
    if IS_PRODUCTION:
        s = os.getenv("SESSION_SECRET")
        if not s:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET is not configured! "
                "A cryptographically strong SESSION_SECRET (at least 32 characters) is required in production."
            )
        s = s.strip()
        if len(s) < 32:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET is too short! "
                "It must be at least 32 characters long to ensure cryptographic integrity."
            )
        if s.lower() in {"secret", "changeme", "default", "session_secret", "12345678901234567890123456789012"}:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET uses an insecure default value! "
                "Set a random, high-entropy secret (e.g., using `openssl rand -hex 32`)."
            )


def _get_dev_secret() -> str:
    """Retrieves or generates a persistent development secret saved in .data/dev_session_secret.txt.
    Prevents session drops across multiple Uvicorn worker processes and live server reloads."""
    secret_file = Path(__file__).parent / ".data" / "dev_session_secret.txt"
    try:
        if secret_file.exists():
            content = secret_file.read_text("utf-8").strip()
            if len(content) >= 32:
                return content
    except OSError:
        pass
    new_secret = secrets.token_urlsafe(32)
    try:
        secret_file.parent.mkdir(parents=True, exist_ok=True)
        secret_file.write_text(new_secret, "utf-8")
        try:
            os.chmod(secret_file, 0o600)
        except OSError:
            pass
        return new_secret
    except OSError:
        return new_secret


_validate_session_secret_at_startup()
_dev_secret: str = _get_dev_secret() if not IS_PRODUCTION else ""


def _secret() -> bytes:
    s = os.getenv("SESSION_SECRET")
    if s:
        s = s.strip()
        if len(s) < 32 and IS_PRODUCTION:
            raise HTTPException(500, "SESSION_SECRET must be at least 32 characters long in production")
        return s.encode()
    if IS_PRODUCTION:
        raise HTTPException(503, "SESSION_SECRET is not configured (required in production)")
    return _dev_secret.encode()



def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(sub: str) -> str:
    payload = _b64(json.dumps({"sub": sub, "exp": int(time.time()) + SESSION_DAYS * 86400}).encode())
    sig = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def _verify(token: str | None) -> str | None:
    if not token or "." not in token:
        return None
    payload, sig = token.rsplit(".", 1)
    good = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, good):
        return None
    try:
        data = json.loads(_unb64(payload))
    except ValueError:
        return None
    if data.get("exp", 0) < time.time():
        return None
    return data.get("sub")


def _set_session(response: Response, request: Request, sub: str) -> None:
    response.set_cookie(
        COOKIE,
        _sign(sub),
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        secure=request.url.scheme == "https" or IS_PRODUCTION,
        samesite="lax",
        path="/",
    )


def _require_csrf(request: Request) -> None:
    # Cross-site pages can't add custom headers without a CORS preflight; the session cookie is also SameSite=Lax.
    if request.headers.get("x-nova") != "1":
        raise HTTPException(403, "Missing X-Nova header")


def _current_sub(request: Request) -> str:
    sub = _verify(request.cookies.get(COOKIE))
    if not sub:
        raise HTTPException(401, "Not signed in")
    return sub


async def _load_json(key: str) -> dict | None:
    raw = await _store().get(key)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None


async def _account_reply(sub: str) -> dict:
    user = await _load_json(_user_key(sub))
    if not user:
        raise HTTPException(401, "Account not found")
    save = await _load_json(_save_key(sub))
    return {"user": _public(user), "savedAt": save.get("savedAt") if save else None}


def _public(user: dict) -> dict:
    return {k: user.get(k) for k in ("sub", "email", "name", "picture")}


async def _upsert_user(sub: str, email: str, name: str, picture: str) -> tuple[dict, bool]:
    now = int(time.time() * 1000)
    user = await _load_json(_user_key(sub))
    is_new = user is None
    user = {**(user or {"createdAt": now}), "sub": sub, "email": email, "name": name, "picture": picture, "lastLoginAt": now}
    await _store().set(_user_key(sub), json.dumps(user))
    return user, is_new


# ── Google ─────────────────────────────────────────────────────────────────


async def _google_profile(access_token: str) -> dict:
    """Checks the token was issued to NOVA's client and returns the Google account's basic profile."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(503, "GOOGLE_CLIENT_ID is not configured")
    async with httpx.AsyncClient(timeout=10) as client:
        info = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"access_token": access_token})
        if info.status_code != 200:
            raise HTTPException(401, "Google could not verify this sign-in")
        tok = info.json()
        if tok.get("aud") != client_id and tok.get("azp") != client_id:
            raise HTTPException(401, "This Google token was issued to a different app")
        me = await client.get("https://openidconnect.googleapis.com/v1/userinfo", headers={"Authorization": f"Bearer {access_token}"})
        if me.status_code != 200:
            raise HTTPException(401, "Could not read the Google profile")
        profile = me.json()
    if not profile.get("sub") or profile.get("sub") != tok.get("sub"):
        raise HTTPException(401, "Google profile does not match the token")
    if profile.get("email_verified") is not True:
        raise HTTPException(401, "Please use a Google account with a verified email")
    return profile


# ── Routes ─────────────────────────────────────────────────────────────────


@router.post("/api/auth/google")
async def auth_google(request: Request, response: Response):
    _require_csrf(request)
    body = await request.json()
    token = body.get("accessToken") if isinstance(body, dict) else None
    if not isinstance(token, str) or not token:
        raise HTTPException(400, "accessToken is required")
    p = await _google_profile(token)
    sub = f"google:{p['sub']}"
    _, is_new = await _upsert_user(sub, p.get("email", ""), p.get("name") or p.get("given_name") or "", p.get("picture", ""))
    _set_session(response, request, sub)
    reply = await _account_reply(sub)
    return {**reply, "isNew": is_new}


@router.post("/api/auth/dev")
async def auth_dev(request: Request, response: Response):
    """Local development only — mock authentication strictly gated against production."""
    if IS_PRODUCTION or os.getenv("NOVA_DEV_LOGIN") != "1":
        raise HTTPException(404, "Not found")
    _require_csrf(request)
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "Invalid JSON body")
    email = str(body.get("email") or "pilot@example.com").strip().lower()
    if not DEV_EMAIL_REGEX.match(email) or len(email) > 100:
        raise HTTPException(400, "Invalid email format (max 100 characters)")
    raw_name = str(body.get("name") or "Test Pilot").strip()
    name = re.sub(r"[\x00-\x1f\x7f<>]", "", raw_name)[:50] or "Test Pilot"
    sub = f"dev:{email}"
    _, is_new = await _upsert_user(sub, email, name, "")
    _set_session(response, request, sub)
    reply = await _account_reply(sub)
    return {**reply, "isNew": is_new}


@router.get("/api/auth/me")
async def auth_me(request: Request):
    return await _account_reply(_current_sub(request))


@router.post("/api/auth/logout")
async def auth_logout(request: Request, response: Response):
    _require_csrf(request)
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/api/progress")
async def get_progress(request: Request):
    sub = _current_sub(request)
    save = await _load_json(_save_key(sub))
    return save or {"savedAt": None, "save": None}


# ── Progress Schema Validation Models ─────────────────────────────────────────

HEX_COLOR_REGEX = re.compile(r"^#[0-9a-fA-F]{3,8}$")


class StatsSyncModel(BaseModel):
    xp: int = Field(0, ge=0, le=10_000_000)
    streak: int = Field(0, ge=0, le=10_000)
    bestStreak: int = Field(0, ge=0, le=10_000)
    correct: int = Field(0, ge=0, le=500_000)
    answered: int = Field(0, ge=0, le=500_000)
    day: Optional[str] = Field(None, max_length=20)
    dayQuizzes: Optional[int] = Field(0, ge=0, le=1000)


class TopicProgressModel(BaseModel):
    cleared: bool = False
    notes: str = Field("", max_length=5000)

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, v: str) -> str:
        return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(v or "")).strip()[:5000]


class ModuleProgressModel(BaseModel):
    passed: bool = False
    best: float = Field(0.0, ge=0.0, le=1.0)
    attempts: int = Field(0, ge=0, le=1000)


class CourseSkillModel(BaseModel):
    mmr: float = Field(0.0, ge=0.0, le=10_000.0)
    history: List[float] = Field(default_factory=list, max_length=100)
    correct: int = Field(0, ge=0, le=500_000)
    answered: int = Field(0, ge=0, le=500_000)
    questionHistory: Optional[Dict[str, bool]] = None

    @field_validator("questionHistory")
    @classmethod
    def limit_question_history(cls, v: Optional[Dict[str, bool]]) -> Optional[Dict[str, bool]]:
        if v and len(v) > 200:
            return dict(list(v.items())[:200])
        return v


class LibraryEntryModel(BaseModel):
    course: Dict[str, Any]
    progress: Dict[str, TopicProgressModel] = Field(default_factory=dict)
    modules: Dict[str, ModuleProgressModel] = Field(default_factory=dict)
    skill: Optional[CourseSkillModel] = None
    current: str = Field("", max_length=100)
    updatedAt: float = Field(0.0)
    completedAt: Optional[float] = None

    @field_validator("course")
    @classmethod
    def validate_course(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(v, dict):
            raise ValueError("course must be an object")
        if "__proto__" in v or "constructor" in v:
            raise ValueError("Forbidden prototype pollution keys")
        if not v.get("id"):
            raise ValueError("course must contain an id")
        return v


class CourseSyncModel(BaseModel):
    activeId: Optional[str] = Field(None, max_length=100)
    library: Dict[str, LibraryEntryModel] = Field(default_factory=dict)
    stats: StatsSyncModel = Field(default_factory=StatsSyncModel)

    @field_validator("library")
    @classmethod
    def limit_library_size(cls, v: Dict[str, LibraryEntryModel]) -> Dict[str, LibraryEntryModel]:
        if len(v) > 60:
            raise ValueError("Maximum 60 courses allowed in library")
        return v


class HubQuizModel(BaseModel):
    id: str = Field(..., max_length=100)
    courseId: str = Field(..., max_length=100)
    formedAt: float
    title: str = Field("", max_length=200)
    questions: List[Any] = Field(default_factory=list, max_length=50)
    limits: List[Optional[float]] = Field(default_factory=list, max_length=50)
    seen: bool = False
    result: Optional[Dict[str, Any]] = None


class HubSyncModel(BaseModel):
    quizzes: List[HubQuizModel] = Field(default_factory=list, max_length=100)
    nextAt: Dict[str, float] = Field(default_factory=dict)

    @field_validator("nextAt")
    @classmethod
    def limit_next_at(cls, v: Dict[str, float]) -> Dict[str, float]:
        if len(v) > 60:
            return dict(list(v.items())[:60])
        return v


class ProfileSyncModel(BaseModel):
    callsign: str = Field("", max_length=50)
    avatar: Optional[str] = Field("", max_length=600_000)
    themeColor: str = Field("#06b6d4", max_length=25)
    activeObjective: Optional[str] = Field(None, max_length=200)

    @field_validator("callsign")
    @classmethod
    def sanitize_callsign(cls, v: str) -> str:
        return re.sub(r"[\x00-\x1f\x7f<>&\"']", "", str(v or "")).strip()[:50]

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, v: Optional[str]) -> str:
        if not v:
            return ""
        s = str(v).strip()
        if len(s) > 600_000:
            raise ValueError("Avatar data exceeds maximum size (600KB)")
        if s.startswith("data:image/") or s.startswith("http://") or s.startswith("https://") or s.startswith("/"):
            return s
        raise ValueError("Invalid avatar URI format")

    @field_validator("themeColor")
    @classmethod
    def validate_color(cls, v: str) -> str:
        s = str(v or "#06b6d4").strip()
        if not HEX_COLOR_REGEX.match(s):
            return "#06b6d4"
        return s

    @field_validator("activeObjective")
    @classmethod
    def sanitize_objective(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        return re.sub(r"[\x00-\x1f\x7f<>&\"']", "", str(v)).strip()[:200]


class ChatMsgModel(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=10_000)
    offline: Optional[bool] = None

    @field_validator("content")
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(v or ""))[:10_000]


class PilotSaveModel(BaseModel):
    v: Literal[1] = 1
    course: CourseSyncModel = Field(default_factory=CourseSyncModel)
    hub: HubSyncModel = Field(default_factory=HubSyncModel)
    profile: ProfileSyncModel = Field(default_factory=ProfileSyncModel)
    tutor: Dict[str, List[ChatMsgModel]] = Field(default_factory=dict)

    @field_validator("tutor")
    @classmethod
    def limit_tutor_threads(cls, v: Dict[str, List[ChatMsgModel]]) -> Dict[str, List[ChatMsgModel]]:
        if len(v) > 50:
            v = dict(list(v.items())[:50])
        return {k: msgs[-40:] if len(msgs) > 40 else msgs for k, msgs in v.items()}


class ProgressPayload(BaseModel):
    savedAt: float
    base: Optional[float] = None
    save: PilotSaveModel


@router.put("/api/progress")
async def put_progress(payload: ProgressPayload, request: Request):
    _require_csrf(request)
    sub = _current_sub(request)

    current = await _load_json(_save_key(sub))
    if current and current.get("savedAt") != payload.base:
        # This copy wasn't made from the latest save (another device saved since); the client downloads that one.
        raise HTTPException(409, "A newer save exists")

    # Serialize validated and sanitized model
    save_dict = payload.save.model_dump()
    data = json.dumps({"savedAt": payload.savedAt, "save": save_dict})
    if len(data.encode("utf-8")) > MAX_SAVE_BYTES:
        raise HTTPException(413, "Save is too large")

    await _store().set(_save_key(sub), data)
    return {"savedAt": payload.savedAt}

