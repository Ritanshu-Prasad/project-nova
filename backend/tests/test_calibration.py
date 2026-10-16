import asyncio

import pytest

import calibration
import limits
import shared
from calibration import observed_difficulty

HASH = "0123456789abcdef"
OTHER = "fedcba9876543210"


def run(coro):
    return asyncio.run(coro)


def post(client, *answers):
    return client.post("/api/feedback/answers", json={"answers": list(answers)})


def answer(correct=True, level="beginner", hash=HASH) -> dict:
    return {"hash": hash, "level": level, "correct": correct}


# --- Counting ---

def test_answers_are_counted_per_question_and_level(client):
    post(client, answer(True), answer(False), answer(True))
    assert run(observed_difficulty(HASH, "beginner")) == (3, 2 / 3)


def test_each_level_is_counted_on_its_own(client):
    post(client, answer(True, "beginner"), answer(False, "advanced"))
    assert run(observed_difficulty(HASH, "beginner")) == (1, 1.0) and run(observed_difficulty(HASH, "advanced")) == (1, 0.0)


def test_each_question_is_counted_on_its_own(client):
    post(client, answer(True), answer(False, hash=OTHER))
    assert run(observed_difficulty(HASH, "beginner"))[1] == 1.0 and run(observed_difficulty(OTHER, "beginner"))[1] == 0.0


def test_counts_add_up_over_several_batches(client):
    post(client, answer(True))
    post(client, answer(False))
    assert run(observed_difficulty(HASH, "beginner")) == (2, 0.5)


def test_a_question_nobody_answered_has_no_difficulty():
    assert run(observed_difficulty(HASH, "beginner")) == (0, None)


def test_the_response_says_how_many_answers_were_counted(client):
    assert post(client, answer(), answer()).json() == {"counted": 2}


# --- What is accepted ---

@pytest.mark.parametrize("bad", [
    {"hash": "short", "level": "beginner", "correct": True},
    {"hash": "G" * 16, "level": "beginner", "correct": True},
    {"hash": HASH + "0", "level": "beginner", "correct": True},
    {"hash": HASH, "level": "expert", "correct": True},
    {"hash": HASH, "level": "beginner"},
])
def test_malformed_answers_are_rejected(client, bad):
    assert post(client, bad).status_code == 422


def test_an_empty_batch_is_rejected(client):
    assert post(client).status_code == 422


def test_a_batch_is_limited_in_size(client):
    assert post(client, *[answer()] * calibration.MAX_BATCH).status_code == 200
    assert post(client, *[answer()] * (calibration.MAX_BATCH + 1)).status_code == 422


# --- Privacy ---

def test_only_a_hash_a_level_and_a_count_are_stored(client):
    client.post("/api/feedback/answers", json={"answers": [answer()]}, headers={"x-forwarded-for": "9.9.9.9", "user-agent": "agent"})
    stored = {key: value for key, (_, value) in shared.state.entries.items() if key.startswith("nova:answers:")}
    assert stored == {f"nova:answers:{HASH}:beginner:right": "1", f"nova:answers:{HASH}:beginner:seen": "1"}


def test_the_batch_cannot_carry_extra_identifying_fields(client):
    post(client, {**answer(), "user": "someone@example.com"})
    assert not any("someone" in key or "someone" in value for key, (_, value) in shared.state.entries.items())


# --- Limits and failures ---

def test_the_route_is_rate_limited(client, monkeypatch):
    monkeypatch.setattr(limits.FEEDBACK_LIMIT, "calls", 1)
    assert post(client, answer()).status_code == 200 and post(client, answer()).status_code == 429


def test_a_store_that_is_down_does_not_fail_the_request(client, monkeypatch):
    class Down(shared.MemoryState):
        async def add(self, key, amount, window_seconds):
            raise shared.StateError("down")

    monkeypatch.setattr(shared, "state", Down())
    assert post(client, answer()).status_code == 200
