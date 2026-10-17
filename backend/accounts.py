"""
Pilot accounts: Google sign-in and a progress save per account.

  POST /api/auth/google   {"accessToken"}       verifies a Google access token and starts a session (HttpOnly cookie)
  GET  /api/auth/me                             the signed-in pilot and when their save was last written
  POST /api/auth/logout                         ends the session on this device
  POST /api/auth/logout-all                     ends every session of the pilot, on all devices
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
import secrets
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

router = APIRouter()

ON_VERCEL = bool(os.getenv("VERCEL"))
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

_dev_secret = secrets.token_urlsafe(32)


def _secret() -> bytes:
    s = os.getenv("SESSION_SECRET")
    if s:
        return s.encode()
    if ON_VERCEL:
        raise HTTPException(503, "SESSION_SECRET is not configured")
    return _dev_secret.encode()  # local only: sessions end when the server restarts


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(sub: str) -> str:
    payload = _b64(json.dumps({"sub": sub, "iat": _now_ms(), "exp": int(time.time()) + SESSION_DAYS * 86400}).encode())
    sig = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _session(token: str | None) -> dict | None:
    """The signed contents of a session cookie, or None when it is missing, forged or expired."""
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
    return data


def _set_session(response: Response, request: Request, sub: str) -> None:
    response.set_cookie(
        COOKIE,
        _sign(sub),
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        secure=request.url.scheme == "https" or ON_VERCEL,
        samesite="lax",
        path="/",
    )


def _require_csrf(request: Request) -> None:
    # Cross-site pages can't add custom headers without a CORS preflight; the session cookie is also SameSite=Lax.
    if request.headers.get("x-nova") != "1":
        raise HTTPException(403, "Missing X-Nova header")


def signed_in_sub(request: Request) -> str | None:
    """Who the cookie says is signed in, without checking the account (for rate limits, which only need a name)."""
    try:
        session = _session(request.cookies.get(COOKIE))
    except HTTPException:
        return None
    return session["sub"] if session else None


async def _current_sub(request: Request) -> str:
    session = _session(request.cookies.get(COOKIE))
    if not session:
        raise HTTPException(401, "Not signed in")
    user = await _load_json(_user_key(session["sub"]))
    if user and session.get("iat", 0) < user.get("sessionsValidFrom", 0):
        raise HTTPException(401, "This session was ended")
    return session["sub"]


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
    """Local testing only — a fake account without Google."""
    if os.getenv("NOVA_DEV_LOGIN") != "1" or ON_VERCEL:
        raise HTTPException(404, "Not found")
    _require_csrf(request)
    body = await request.json()
    email = str(body.get("email") or "pilot@example.com")
    sub = f"dev:{email}"
    _, is_new = await _upsert_user(sub, email, str(body.get("name") or "Test Pilot"), "")
    _set_session(response, request, sub)
    reply = await _account_reply(sub)
    return {**reply, "isNew": is_new}


@router.get("/api/auth/me")
async def auth_me(request: Request):
    return await _account_reply(await _current_sub(request))


@router.post("/api/auth/logout")
async def auth_logout(request: Request, response: Response):
    _require_csrf(request)
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.post("/api/auth/logout-all")
async def auth_logout_all(request: Request, response: Response):
    _require_csrf(request)
    sub = await _current_sub(request)
    user = await _load_json(_user_key(sub))
    await _store().set(_user_key(sub), json.dumps({**user, "sessionsValidFrom": _now_ms()}))
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/api/progress")
async def get_progress(request: Request):
    sub = await _current_sub(request)
    save = await _load_json(_save_key(sub))
    return save or {"savedAt": None, "save": None}


@router.put("/api/progress")
async def put_progress(request: Request):
    _require_csrf(request)
    sub = await _current_sub(request)
    raw = await request.body()
    if len(raw) > MAX_SAVE_BYTES:
        raise HTTPException(413, "Save is too large")
    try:
        body = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "Invalid JSON")
    saved_at = body.get("savedAt") if isinstance(body, dict) else None
    save = body.get("save") if isinstance(body, dict) else None
    if not isinstance(saved_at, (int, float)) or not isinstance(save, dict):
        raise HTTPException(400, "Expected {savedAt: number, save: object}")
    current = await _load_json(_save_key(sub))
    if current and current.get("savedAt") != body.get("base"):
        # This copy wasn't made from the latest save (another device saved since); the client downloads that one.
        raise HTTPException(409, "A newer save exists")
    await _store().set(_save_key(sub), json.dumps({"savedAt": saved_at, "save": save}))
    return {"savedAt": saved_at}
