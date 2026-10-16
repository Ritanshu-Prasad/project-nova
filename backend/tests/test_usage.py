import asyncio

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

import shared
import usage


def run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def fresh_request():
    usage.begin()


# --- Per request ---

def test_calls_and_tokens_are_added_up_for_the_request():
    run(usage.record_call("lesson", {"total_tokens": 1200}, 3.0))
    run(usage.record_call("quiz", {"total_tokens": 800}, 2.0))
    assert usage.current().describe() == "calls=2 tokens=2000 retries=0"


def test_retries_are_counted():
    usage.record_retry(), usage.record_retry()
    assert usage.current().retries == 2


def test_a_call_without_usage_information_still_counts():
    run(usage.record_call("lesson", None, 1.0))
    assert usage.current().calls == 1 and usage.current().tokens == 0


def test_each_request_starts_from_zero():
    run(usage.record_call("lesson", {"total_tokens": 10}, 1.0))
    assert usage.begin().calls == 0


def test_nothing_is_recorded_outside_a_request():
    usage._current.set(None)
    usage.record_retry()
    run(usage.record_call("lesson", {"total_tokens": 10}, 1.0))


# --- Daily budget ---

def budget(monkeypatch, limit="1000"):
    monkeypatch.setenv("NOVA_DAILY_TOKEN_BUDGET", limit)


def test_without_a_budget_nothing_is_stored_or_refused():
    run(usage.record_call("lesson", {"total_tokens": 10**9}, 1.0))
    run(usage.check_budget())
    assert shared.state.entries == {}


def test_tokens_are_counted_against_the_day(monkeypatch):
    budget(monkeypatch)
    run(usage.record_call("lesson", {"total_tokens": 400}, 1.0))
    run(usage.record_call("lesson", {"total_tokens": 300}, 1.0))
    assert int(run(shared.state.get(usage._today()))) == 700


def test_work_is_refused_once_the_budget_is_used(monkeypatch):
    budget(monkeypatch)
    run(usage.check_budget())
    run(usage.record_call("lesson", {"total_tokens": 1000}, 1.0))
    with pytest.raises(HTTPException) as error:
        run(usage.check_budget())
    assert error.value.status_code == 503 and "tomorrow" in error.value.detail


def test_a_new_day_starts_a_new_count(monkeypatch):
    budget(monkeypatch)
    run(usage.record_call("lesson", {"total_tokens": 1000}, 1.0))
    monkeypatch.setattr(usage.time, "strftime", lambda fmt, now: "2099-01-01")
    run(usage.check_budget())


def test_an_unreachable_store_never_blocks_work(monkeypatch):
    class Down:
        async def add(self, key, amount, window):
            raise shared.StateError("down")

        async def get(self, key):
            raise shared.StateError("down")

    budget(monkeypatch)
    monkeypatch.setattr(shared, "state", Down())
    run(usage.record_call("lesson", {"total_tokens": 500}, 1.0))
    run(usage.check_budget())


def test_the_budget_guards_the_routes(client, fake_model, monkeypatch):
    budget(monkeypatch, "1")
    run(usage.record_call("lesson", {"total_tokens": 5}, 1.0))
    goal = {"mode": "goal", "level": "beginner", "objective": "Docker"}
    assert client.post("/api/courses/generate", data=goal).status_code == 503
    assert client.post("/api/courses/generate/stream", data=goal).status_code == 503
    assert client.post("/api/courses/topic", json={"level": "beginner", "objective": "Docker", "course": "D", "module": "M", "topic": "T"}).status_code == 503
    assert fake_model.calls == []


def test_the_budget_works_as_a_dependency(monkeypatch):
    budget(monkeypatch)
    app = FastAPI()

    @app.get("/work", dependencies=[Depends(usage.check_budget)])
    def work():
        return "done"

    client = TestClient(app)
    assert client.get("/work").status_code == 200
    run(shared.state.add(usage._today(), 5000, 60))
    assert client.get("/work").status_code == 503
