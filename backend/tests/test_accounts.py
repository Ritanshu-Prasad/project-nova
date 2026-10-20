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


def test_progress_put_and_get(client):
    sign_in(client)
    payload = {"savedAt": 1000, "save": {"stats": {"xp": 50}}, "base": None}
    res = client.put("/api/progress", json=payload, headers=HEADERS)
    assert res.status_code == 200
    assert res.json() == {"savedAt": 1000}
    get_res = client.get("/api/progress")
    assert get_res.status_code == 200
    assert get_res.json()["savedAt"] == 1000
    assert get_res.json()["save"]["stats"]["xp"] == 50


def test_progress_put_conflict_on_stale_base(client):
    sign_in(client)
    payload = {"savedAt": 1000, "save": {"xp": 50}, "base": None}
    client.put("/api/progress", json=payload, headers=HEADERS)
    stale_payload = {"savedAt": 1050, "save": {"xp": 60}, "base": 500}
    res = client.put("/api/progress", json=stale_payload, headers=HEADERS)
    assert res.status_code == 409


def test_progress_put_invalid_payload(client):
    sign_in(client)
    res = client.put("/api/progress", json={"invalid": "payload"}, headers=HEADERS)
    assert res.status_code == 422


def test_progress_put_csrf_required(client):
    sign_in(client)
    payload = {"savedAt": 1000, "save": {"xp": 50}, "base": None}
    res = client.put("/api/progress", json=payload)
    assert res.status_code == 403


def test_dev_session_secret_file_persistence(tmp_path, monkeypatch):
    secret_file = tmp_path / "dev_session_secret.txt"
    monkeypatch.setattr(accounts, "DEV_SECRET_FILE", secret_file)
    monkeypatch.setattr(accounts, "_dev_secret", None)
    monkeypatch.delenv("SESSION_SECRET", raising=False)

    sec1 = accounts._get_dev_secret()
    assert secret_file.is_file()
    assert secret_file.read_text("utf-8").strip() == sec1

    # In a new process run, it should read the exact same secret from file
    monkeypatch.setattr(accounts, "_dev_secret", None)
    sec2 = accounts._get_dev_secret()
    assert sec2 == sec1

