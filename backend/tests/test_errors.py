import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import admin
import errors
import observability
import records
import shared

TOKEN = "s3cret-token"


def run(coroutine):
    return asyncio.run(coroutine)


# --- The shared helper ---

def test_records_come_back_newest_first_and_only_the_cap_is_kept():
    for number in range(5):
        run(records.push("things", {"time": f"2026-10-22T10:00:0{number}Z", "n": number}, cap=3))
    assert [item["n"] for item in run(records.newest("things", 10))] == [4, 3, 2]


def test_different_names_do_not_mix():
    run(records.push("a", {"time": "2026-10-22T10:00:00Z"}, cap=3))
    assert run(records.newest("b", 10)) == []


def test_a_store_that_cannot_be_reached_is_survived(monkeypatch):
    async def broken(*_):
        raise shared.StateError("down")

    monkeypatch.setattr(shared.state, "push_capped", broken)
    monkeypatch.setattr(shared.state, "recent", broken)
    run(records.push("things", {"time": "x"}, cap=3))
    assert run(records.newest("things", 10)) == []


# --- The error record ---

def raise_deep():
    def inner():
        raise ValueError("the model said something odd " + "x" * 500)

    inner()


def test_an_error_record_names_the_error_where_it_happened_and_the_request():
    try:
        raise_deep()
    except ValueError as error:
        record = errors.build_record(error, "req1", "POST", "/api/courses/topic")
    assert record["type"] == "ValueError" and record["request_id"] == "req1" and record["path"] == "/api/courses/topic"
    assert len(record["message"]) == errors.MESSAGE_CHARS and record["message"].startswith("the model said something odd")
    assert any("in inner" in line for line in record["where"]) and len(record["where"]) <= errors.FRAMES
    assert all(":" in line and "/" not in line.split(" in ")[0] for line in record["where"])


# --- Saved by the request log ---

@pytest.fixture
def app():
    app = FastAPI()
    observability.add_request_logging(app)

    @app.get("/boom")
    def boom():
        raise RuntimeError("something broke")

    @app.get("/refused")
    def refused():
        from fastapi import HTTPException

        raise HTTPException(422, "no")

    return TestClient(app, raise_server_exceptions=False)


def test_an_unhandled_error_is_kept_with_its_request_id(app):
    assert app.get("/boom", headers={"x-request-id": "abc123"}).status_code == 500
    (saved,) = run(errors.recent(10))
    assert saved["type"] == "RuntimeError" and saved["message"] == "something broke" and saved["request_id"] == "abc123" and saved["path"] == "/boom"


def test_an_error_the_app_answers_on_purpose_is_not_an_unhandled_error(app):
    assert app.get("/refused").status_code == 422
    assert run(errors.recent(10)) == []


# --- Admin ---

@pytest.fixture
def admin_client(monkeypatch):
    monkeypatch.setenv("NOVA_ADMIN_TOKEN", TOKEN)
    app = FastAPI()
    app.include_router(admin.router)
    return TestClient(app)


def test_the_error_list_needs_the_token_and_honours_the_limit(admin_client):
    assert admin_client.get("/api/admin/errors").status_code == 401
    for number in range(3):
        try:
            raise KeyError(number)
        except KeyError as error:
            run(errors.save(error, f"r{number}", "GET", "/x"))
    body = admin_client.get("/api/admin/errors?limit=2", headers={"Authorization": f"Bearer {TOKEN}"}).json()
    assert len(body["errors"]) == 2 and admin_client.get("/api/admin/errors?limit=0", headers={"Authorization": f"Bearer {TOKEN}"}).status_code == 422


def test_the_page_has_an_errors_section(admin_client):
    assert "Errors" in admin_client.get("/api/admin").text and "/api/admin/errors" in admin_client.get("/api/admin").text
