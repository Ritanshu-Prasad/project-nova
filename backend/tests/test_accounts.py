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


def test_progress_accepts_an_objective_as_long_as_a_course_request_allows(client):
    sign_in(client)
    base = None
    for length, status in ((300, 200), (500, 200), (501, 422)):
        payload = {"savedAt": length, "save": {"profile": {"activeObjective": "x" * length}}, "base": base}
        assert client.put("/api/progress", json=payload, headers=HEADERS).status_code == status
        base = length if status == 200 else base


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


def test_google_auth_success(client, monkeypatch):
    client_id = "test-client-id.apps.googleusercontent.com"
    monkeypatch.setenv("GOOGLE_CLIENT_ID", client_id)

    async def fake_get(self, url, **kwargs):
        class FakeResponse:
            def __init__(self, status_code, data):
                self.status_code = status_code
                self._data = data

            def json(self):
                return self._data

        if "tokeninfo" in str(url):
            return FakeResponse(200, {"aud": client_id, "sub": "google-user-123"})
        if "userinfo" in str(url):
            return FakeResponse(200, {
                "sub": "google-user-123",
                "email": "pilot@example.com",
                "name": "Nova Pilot",
                "picture": "https://lh3.googleusercontent.com/avatar.jpg",
                "email_verified": True,
            })
        return FakeResponse(404, {})

    monkeypatch.setattr(accounts.httpx.AsyncClient, "get", fake_get)

    res = client.post("/api/auth/google", json={"accessToken": "valid-token"}, headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["isNew"] is True
    assert data["user"]["sub"] == "google:google-user-123"
    assert data["user"]["email"] == "pilot@example.com"
    assert data["user"]["picture"] == "https://lh3.googleusercontent.com/avatar.jpg"
    assert accounts.COOKIE in client.cookies

    # Verify session cookie allows reading account
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["user"]["sub"] == "google:google-user-123"

    # Second login is not new
    res2 = client.post("/api/auth/google", json={"accessToken": "valid-token"}, headers=HEADERS)
    assert res2.status_code == 200
    assert res2.json()["isNew"] is False


def test_google_auth_wrong_client_id(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "expected-client-id")

    async def fake_get(self, url, **kwargs):
        class FakeResponse:
            def __init__(self, status_code, data):
                self.status_code = status_code
                self._data = data

            def json(self):
                return self._data

        return FakeResponse(200, {"aud": "different-client-id", "azp": "different-client-id", "sub": "123"})

    monkeypatch.setattr(accounts.httpx.AsyncClient, "get", fake_get)
    res = client.post("/api/auth/google", json={"accessToken": "token-for-other-app"}, headers=HEADERS)
    assert res.status_code == 401
    assert "issued to a different app" in res.json()["detail"]


def test_google_auth_unverified_email(client, monkeypatch):
    client_id = "test-client-id"
    monkeypatch.setenv("GOOGLE_CLIENT_ID", client_id)

    async def fake_get(self, url, **kwargs):
        class FakeResponse:
            def __init__(self, status_code, data):
                self.status_code = status_code
                self._data = data

            def json(self):
                return self._data

        if "tokeninfo" in str(url):
            return FakeResponse(200, {"aud": client_id, "sub": "123"})
        return FakeResponse(200, {"sub": "123", "email": "unverified@example.com", "email_verified": False})

    monkeypatch.setattr(accounts.httpx.AsyncClient, "get", fake_get)
    res = client.post("/api/auth/google", json={"accessToken": "token"}, headers=HEADERS)
    assert res.status_code == 401
    assert "verified email" in res.json()["detail"]


def test_google_auth_missing_token_or_csrf(client):
    # Missing CSRF
    res = client.post("/api/auth/google", json={"accessToken": "token"})
    assert res.status_code == 403

    # Missing token
    res = client.post("/api/auth/google", json={}, headers=HEADERS)
    assert res.status_code == 400


def test_session_secret_rotation_invalidates_session(client, monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", "old-secret-12345678901234567890123456789012")
    sign_in(client)
    assert client.get("/api/auth/me").status_code == 200

    # Rotate secret
    monkeypatch.setenv("SESSION_SECRET", "new-secret-98765432109876543210987654321098")
    assert client.get("/api/auth/me").status_code == 401


def test_google_auth_missing_client_id(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    res = client.post("/api/auth/google", json={"accessToken": "token"}, headers=HEADERS)
    assert res.status_code == 503
    assert "GOOGLE_CLIENT_ID is not configured" in res.json()["detail"]


def test_google_auth_token_rejected_by_google(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")

    async def fake_get(self, url, **kwargs):
        class FakeResponse:
            status_code = 400

            def json(self):
                return {"error": "invalid_token"}

        return FakeResponse()

    monkeypatch.setattr(accounts.httpx.AsyncClient, "get", fake_get)
    res = client.post("/api/auth/google", json={"accessToken": "expired-token"}, headers=HEADERS)
    assert res.status_code == 401
    assert "could not verify this sign-in" in res.json()["detail"]


