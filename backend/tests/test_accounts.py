import asyncio
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import accounts

HEADERS = {"X-Nova": "1"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "store", accounts.FileStore(tmp_path / "accounts.json"))
    monkeypatch.setenv("NOVA_DEV_LOGIN", "1")
    app = FastAPI()
    app.include_router(accounts.router)
    return TestClient(app)


def sign_in(client: TestClient, email: str = "a@example.com") -> dict:
    return client.post("/api/auth/dev", json={"email": email}, headers=HEADERS).json()




def test_a_signed_in_pilot_can_read_their_account(client):
    sign_in(client)
    assert client.get("/api/auth/me").json()["user"]["email"] == "a@example.com"


def test_no_cookie_is_401(client):
    assert client.get("/api/auth/me").status_code == 401


def test_a_tampered_cookie_is_401(client):
    sign_in(client)
    client.cookies.set(accounts.COOKIE, client.cookies[accounts.COOKIE][:-2] + "xx")
    assert client.get("/api/auth/me").status_code == 401


def test_logout_ends_this_session_only(client, tmp_path):
    sign_in(client)
    other = TestClient(client.app, cookies=dict(client.cookies))
    client.post("/api/auth/logout", headers=HEADERS)
    assert client.get("/api/auth/me").status_code == 401
    assert other.get("/api/auth/me").status_code == 200


def test_logout_all_ends_every_session(client, monkeypatch):
    sign_in(client)
    other = TestClient(client.app, cookies=dict(client.cookies))
    monkeypatch.setattr(accounts, "_now_ms", lambda: 10**15)  # a moment after both sessions began
    assert client.post("/api/auth/logout-all", headers=HEADERS).status_code == 200
    assert other.get("/api/auth/me").status_code == 401


def test_signing_in_again_after_logout_all_works(client):
    sign_in(client)
    client.post("/api/auth/logout-all", headers=HEADERS)
    sign_in(client)
    assert client.get("/api/auth/me").status_code == 200


def test_logout_all_needs_the_csrf_header(client):
    sign_in(client)
    assert client.post("/api/auth/logout-all").status_code == 403


def test_sessions_made_before_revocation_existed_still_work(client):
    sign_in(client)
    sub = "dev:a@example.com"
    user = json.loads(asyncio.run(accounts.store.get(accounts._user_key(sub))))
    assert "sessionsValidFrom" not in user
    assert client.get("/api/auth/me").status_code == 200


def test_progress_needs_a_session(client):
    assert client.get("/api/progress").status_code == 401
