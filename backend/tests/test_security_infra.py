"""Security infrastructure tests: CORS, CSRF, rate limiting, dev-login gating, anti-cheat, schemas, startup checks."""
import asyncio
import functools
import json
from typing import Any, Awaitable, Callable

import httpx
import pytest
from fastapi import FastAPI

import accounts
import fleet
import tutor
from security import SecurityHeadersMiddleware, configure_cors, is_dev_backdoor_enabled, validate_secrets_on_startup

H = {"X-Nova": "1"}
ALLOWED = "https://nova.example"
EVIL = "https://malicious-site.com"
PILOT = "0123456789abcdef0123456789abcdef"
PROD_KEYS = ("ENVIRONMENT", "VERCEL", "AWS_EXECUTION_ENV", "KUBERNETES_SERVICE_HOST", "FLY_APP_NAME", "RENDER")


def arun(fn: Callable[..., Awaitable[None]]) -> Callable[..., None]:
    """Run an async test body on its own event loop (no pytest plugin needed); fixtures still resolve."""

    @functools.wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> None:
        asyncio.run(fn(*args, **kwargs))

    return wrapper


@pytest.fixture(autouse=True)
def dev_env(tmp_path, monkeypatch):
    """Non-production env, fresh account store, fresh throttles/limiters, known CORS origin."""
    for key in PROD_KEYS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("NOVA_DEV_LOGIN", "1")
    monkeypatch.setenv("ALLOWED_ORIGINS", ALLOWED)
    monkeypatch.delenv("NOVA_RATE_LIMIT", raising=False)
    monkeypatch.setattr(accounts, "store", accounts.FileStore(tmp_path / "accounts.json"))
    monkeypatch.setattr(fleet, "_last_submissions", {})
    tutor.CHAT_BURST_LIMIT._history.clear()  # the route holds this instance; reset it in place


def make_client() -> httpx.AsyncClient:
    app = FastAPI()
    configure_cors(app)
    app.add_middleware(SecurityHeadersMiddleware)
    for r in (accounts.router, fleet.router, tutor.router):
        app.include_router(r)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def sign_in(c: httpx.AsyncClient) -> None:
    res = await c.post("/api/auth/dev", json={"email": "pilot@example.com", "name": "Test Pilot"}, headers=H)
    assert res.status_code == 200


def progress(save: dict) -> dict:
    return {"savedAt": 1000, "base": None, "save": save}


# --- CORS ---

@arun
async def test_cors_preflight_allowed_origin():
    async with make_client() as c:
        res = await c.options("/api/auth/me", headers={"Origin": ALLOWED, "Access-Control-Request-Method": "GET"})
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == ALLOWED
    assert res.headers["access-control-allow-credentials"] == "true"


@arun
async def test_cors_preflight_unauthorized_origin_rejected():
    async with make_client() as c:
        res = await c.options("/api/auth/me", headers={"Origin": EVIL, "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in res.headers
    assert res.status_code == 400


@arun
async def test_cors_never_allows_unlisted_header_or_wildcard():
    async with make_client() as c:
        res = await c.options("/api/auth/me", headers={"Origin": ALLOWED, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "X-Evil"})
    assert res.status_code == 400
    assert res.headers.get("access-control-allow-origin") != "*"


@arun
async def test_security_headers_are_set():
    async with make_client() as c:
        res = await c.get("/api/auth/me")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in res.headers["content-security-policy"]


# --- CSRF ---

@arun
async def test_csrf_missing_header_rejected_on_progress_put():
    async with make_client() as c:
        await sign_in(c)
        res = await c.put("/api/progress", json=progress({}))
    assert res.status_code == 403


@arun
async def test_csrf_missing_header_rejected_on_tutor_chat():
    body = {"messages": [{"role": "user", "content": "test"}], "context": {"lesson": "Bridges connect containers."}}
    async with make_client() as c:
        res = await c.post("/api/tutor/chat", json=body)
    assert res.status_code == 403


# --- Rate limiting ---

@arun
async def test_tutor_rate_limit_triggers_429():
    body = {"messages": [{"role": "user", "content": "hi"}], "context": {"lesson": "Bridges connect containers."}}
    async with make_client() as c:
        codes = [(await c.post("/api/tutor/chat", json=body, headers=H)).status_code for _ in range(15)]
        assert 429 not in codes
        res = await c.post("/api/tutor/chat", json=body, headers=H)
    assert res.status_code == 429
    assert int(res.headers["retry-after"]) >= 1


# --- Dev login gating ---

@arun
async def test_dev_login_available_outside_production():
    async with make_client() as c:
        res = await c.post("/api/auth/dev", json={"email": "pilot@example.com"}, headers=H)
    assert res.status_code == 200


@arun
async def test_dev_login_is_404_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("NOVA_DEV_LOGIN", "1")
    assert is_dev_backdoor_enabled() is False
    async with make_client() as c:
        res = await c.post("/api/auth/dev", json={"email": "pilot@example.com"}, headers=H)
    assert res.status_code == 404


@arun
async def test_dev_login_rejects_malformed_email_and_name():
    async with make_client() as c:
        bad_email = await c.post("/api/auth/dev", json={"email": "<script>@x"}, headers=H)
        bad_name = await c.post("/api/auth/dev", json={"email": "a@example.com", "name": "<img onerror=x>"}, headers=H)
    assert bad_email.status_code == 400
    assert bad_name.status_code == 400


# --- Anti-cheat ---

@arun
async def test_leaderboard_submission_throttled():
    body = {"pilotId": PILOT, "callsign": "Goose", "xp": 100}
    async with make_client() as c:
        assert (await c.post("/api/fleet/score", json=body, headers=H)).status_code == 200
        res = await c.post("/api/fleet/score", json=body, headers=H)
    assert res.status_code == 429


@arun
async def test_leaderboard_xp_delta_is_clamped():
    body = {"pilotId": PILOT, "callsign": "Maverick", "xp": 1000}
    async with make_client() as c:
        assert (await c.post("/api/fleet/score", json=body, headers=H)).status_code == 200
        # let the throttle window pass
        fleet._last_submissions.clear()
        board = json.loads(await accounts.store.get(fleet.BOARD_KEY))
        for entry in board.values():
            entry["at"] -= 10_000
        await accounts.store.set(fleet.BOARD_KEY, json.dumps(board))
        assert (await c.post("/api/fleet/score", json={**body, "xp": 11_000}, headers=H)).status_code == 200
        top = (await c.get(f"/api/fleet/leaderboard?board=global&pilot={PILOT}")).json()["top"]
    assert top[0]["score"] == 1000 + 5000


# --- Schemas ---

@arun
async def test_progress_prototype_pollution_rejected_422():
    async with make_client() as c:
        await sign_in(c)
        res = await c.put("/api/progress", json=progress({"__proto__": {"admin": True}}), headers=H)
        nested = await c.put("/api/progress", json=progress({"profile": {"constructor": {"x": 1}}}), headers=H)
        top = await c.put("/api/progress", content='{"savedAt": 1, "save": {}, "__proto__": {"a": 1}}', headers={**H, "Content-Type": "application/json"})
    assert res.status_code == 422
    assert nested.status_code == 422
    assert top.status_code == 422


@arun
async def test_progress_callsign_is_sanitized():
    async with make_client() as c:
        await sign_in(c)
        res = await c.put("/api/progress", json=progress({"profile": {"callsign": "<script>alert('x')</script>Ace"}}), headers=H)
        assert res.status_code == 200
        saved = (await c.get("/api/progress")).json()["save"]["profile"]["callsign"]
    assert not any(ch in saved for ch in "<>&\"'")
    assert saved.endswith("Ace")


@arun
async def test_progress_keeps_client_keys_outside_the_schema():
    async with make_client() as c:
        await sign_in(c)
        await c.put("/api/progress", json=progress({"course": {"activeId": "x"}, "hub": {"quizzes": []}, "tutor": {}}), headers=H)
        saved = (await c.get("/api/progress")).json()["save"]
    assert saved["course"] == {"activeId": "x"}
    assert "hub" in saved and "tutor" in saved


@arun
async def test_progress_rejects_bad_avatar_and_color():
    async with make_client() as c:
        await sign_in(c)
        avatar = await c.put("/api/progress", json=progress({"profile": {"avatar": "javascript:alert(1)"}}), headers=H)
        color = await c.put("/api/progress", json=progress({"profile": {"themeColor": "red;}</style>"}}), headers=H)
    assert avatar.status_code == 422
    assert color.status_code == 422


# --- Startup validation ---

def test_startup_fails_without_secret_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="must be configured"):
        validate_secrets_on_startup()


def test_startup_fails_with_short_secret_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SESSION_SECRET", "too-short")
    with pytest.raises(RuntimeError, match=">= 32"):
        validate_secrets_on_startup()


def test_startup_fails_with_insecure_default_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SESSION_SECRET", "change_me_to_a_random_32_byte_secret_string")
    with pytest.raises(RuntimeError, match="insecure default"):
        validate_secrets_on_startup()


def test_startup_passes_with_strong_secret_or_in_dev(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SESSION_SECRET", "x" * 40)
    validate_secrets_on_startup()
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("SESSION_SECRET", raising=False)
    validate_secrets_on_startup()
