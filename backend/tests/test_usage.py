import asyncio
import logging
import time

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

import shared
import usage

MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"


def run(coro):
    return asyncio.run(coro)


def call(kind="lesson", prompt=1000, completion=200, seconds=2.0, model=MODEL):
    run(usage.record_call(kind, model, {"prompt_tokens": prompt, "completion_tokens": completion}, seconds))


@pytest.fixture(autouse=True)
def fresh_request():
    usage.begin()


def report(days=1, models=(MODEL,)) -> list:
    return run(usage.daily_report(days, list(models)))


# --- Per request ---

def test_calls_and_tokens_are_added_up_for_the_request():
    call("lesson", 1000, 200)
    call("quiz", 600, 200)
    assert usage.current().calls == 2 and usage.current().tokens == 2000
    assert (usage.current().prompt_tokens, usage.current().completion_tokens) == (1600, 400)


def test_the_request_cost_follows_the_price(monkeypatch):
    monkeypatch.setenv("NOVA_PRICE_INPUT_PER_M", "1")
    monkeypatch.setenv("NOVA_PRICE_OUTPUT_PER_M", "2")
    call(prompt=1_000_000, completion=500_000)
    assert usage.current().cost_usd == pytest.approx(2.0)


def test_a_request_describes_itself_with_an_estimated_cost():
    call(prompt=1_000_000, completion=0)
    assert usage.current().describe() == "calls=1 tokens=1000000 ~$0.0600 retries=0"


def test_retries_and_failures_are_counted_for_the_request():
    run(usage.record_retry("lesson", MODEL)), run(usage.record_retry("lesson", MODEL))
    run(usage.record_failure("quiz", MODEL))
    assert usage.current().retries == 2 and usage.current().failures == 1


def test_a_call_without_usage_information_still_counts():
    run(usage.record_call("lesson", MODEL, None, 1.0))
    assert usage.current().calls == 1 and usage.current().tokens == 0


def test_each_request_starts_from_zero():
    call()
    assert usage.begin().calls == 0


def test_nothing_is_recorded_outside_a_request():
    usage._current.set(None)
    run(usage.record_retry("lesson", MODEL))
    call()


# --- The ledger ---

def test_a_call_is_written_to_the_days_ledger_by_kind():
    call("lesson", 1000, 200, 2.0)
    call("lesson", 500, 100, 4.0)
    lesson = report()[0]["kinds"]["lesson"]
    assert (lesson["calls"], lesson["prompt_tokens"], lesson["completion_tokens"]) == (2, 1500, 300)
    assert lesson["seconds"] == 6.0 and lesson["average_seconds"] == 3.0


def test_the_estimated_cost_is_computed_from_the_counted_tokens():
    call("lesson", 1_000_000, 1_000_000)
    assert report()[0]["kinds"]["lesson"]["cost_usd"] == pytest.approx(0.30)


def test_kinds_are_kept_apart_and_totalled():
    call("lesson", 100, 50), call("quiz", 200, 100)
    today = report()[0]
    assert set(today["kinds"]) == {"lesson", "quiz"} and today["totals"]["calls"] == 2 and today["totals"]["prompt_tokens"] == 300


def test_latency_is_counted_in_buckets():
    for seconds in (0.5, 2.0, 2.5, 8.0, 20.0, 100.0):
        call("lesson", seconds=seconds)
    assert report()[0]["kinds"]["lesson"]["latency"] == {"le_1": 1, "le_3": 2, "le_10": 1, "le_30": 1, "le_inf": 1}


def test_retries_and_failures_reach_the_ledger_too():
    call("lesson")
    run(usage.record_retry("lesson", MODEL)), run(usage.record_failure("lesson", MODEL))
    lesson = report()[0]["kinds"]["lesson"]
    assert lesson["retries"] == 1 and lesson["failures"] == 1


def test_a_kind_with_only_failures_still_shows_up():
    run(usage.record_failure("quiz", MODEL))
    assert report()[0]["kinds"]["quiz"]["failures"] == 1


def test_models_are_kept_apart_in_the_ledger_and_added_in_the_report():
    call("lesson", 100, 0, model="a/model"), call("lesson", 300, 0, model="b/model")
    assert report(models=("a/model",))[0]["kinds"]["lesson"]["prompt_tokens"] == 100
    assert report(models=("a/model", "b/model"))[0]["kinds"]["lesson"]["prompt_tokens"] == 400


def test_days_are_listed_newest_first_and_quiet_days_are_empty():
    days = report(days=3)
    assert [d["day"] for d in days] == [usage._day(time.time() - n * 86400) for n in range(3)]
    assert all(d["kinds"] == {} and d["totals"]["calls"] == 0 for d in days[1:])


def test_yesterdays_calls_are_in_yesterdays_row(monkeypatch):
    call("lesson")
    real_time = time.time
    monkeypatch.setattr(usage.time, "time", lambda: real_time() + 86400)
    days = report(days=2)
    assert days[0]["kinds"] == {} and days[1]["kinds"]["lesson"]["calls"] == 1


def test_events_are_counted_per_day():
    for name in ("cache:course:hit", "cache:course:hit", "cache:course:miss", "limit_denied:course"):
        run(usage.record_event(name))
    assert report()[0]["events"] == {"cache:course:hit": 2, "cache:course:miss": 1, "limit_denied:course": 1}


def test_the_ledger_expires_after_ninety_days(monkeypatch):
    stored = []

    class Recording(shared.MemoryState):
        async def hincr_many(self, key, amounts, ttl_seconds):
            stored.append(ttl_seconds)
            await super().hincr_many(key, amounts, ttl_seconds)

    monkeypatch.setattr(shared, "state", Recording())
    call()
    assert set(stored) == {90 * 24 * 3600}


def test_an_unreachable_store_does_not_break_calls_or_reports(monkeypatch):
    class Down(shared.MemoryState):
        async def hincr_many(self, key, amounts, ttl_seconds):
            raise shared.StateError("down")

        async def hgetall(self, key):
            raise shared.StateError("down")

    monkeypatch.setattr(shared, "state", Down())
    call()
    assert usage.current().calls == 1 and report()[0]["totals"]["calls"] == 0


# --- Daily budget ---

def budget(monkeypatch, limit="1000"):
    monkeypatch.setenv("NOVA_DAILY_TOKEN_BUDGET", limit)


def test_without_a_budget_nothing_is_counted_for_it_or_refused():
    call(prompt=10**9, completion=0)
    run(usage.check_budget())
    assert not any(key.startswith("nova:tokens:") for key in shared.state.entries)


def test_tokens_are_counted_against_the_day(monkeypatch):
    budget(monkeypatch)
    call(prompt=300, completion=100), call(prompt=200, completion=100)
    assert run(usage.used_today()) == 700


def test_work_is_refused_once_the_budget_is_used(monkeypatch):
    budget(monkeypatch)
    run(usage.check_budget())
    call(prompt=900, completion=100)
    with pytest.raises(HTTPException) as error:
        run(usage.check_budget())
    assert error.value.status_code == 503 and "tomorrow" in error.value.detail


def test_a_new_day_starts_a_new_count(monkeypatch):
    budget(monkeypatch)
    call(prompt=1000, completion=0)
    monkeypatch.setattr(usage.time, "strftime", lambda fmt, now=None: "2099-01-01")
    run(usage.check_budget())


def test_the_budget_warning_comes_once_when_eighty_percent_is_crossed(monkeypatch, caplog):
    budget(monkeypatch, "1000")
    with caplog.at_level(logging.WARNING, logger="nova.usage"):
        for tokens in (500, 250, 100, 100, 100):
            call(prompt=tokens, completion=0)
    warnings = [r.getMessage() for r in caplog.records if "budget is 80% used" in r.getMessage()]
    assert len(warnings) == 1 and "850 of 1000" in warnings[0]


def test_an_unreachable_store_never_blocks_work(monkeypatch):
    class Down(shared.MemoryState):
        async def add(self, key, amount, window):
            raise shared.StateError("down")

        async def get(self, key):
            raise shared.StateError("down")

    budget(monkeypatch)
    monkeypatch.setattr(shared, "state", Down())
    call(prompt=500, completion=0)
    run(usage.check_budget())


def test_the_budget_guards_the_routes(client, fake_model, monkeypatch):
    budget(monkeypatch, "1")
    call(prompt=5, completion=0)
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
    run(shared.state.add(usage._budget_key(), 5000, 60))
    assert client.get("/work").status_code == 503
