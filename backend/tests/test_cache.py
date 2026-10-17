import asyncio

import pytest

import cache
import llm
import shared
from cache import ResultCache


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def store():
    return ResultCache("test", ttl_seconds=60)


def test_a_stored_value_is_returned(store):
    run(store.put(("a",), {"x": 1}))
    assert run(store.get(("a",))) == {"x": 1}


def test_an_unknown_key_returns_nothing(store):
    assert run(store.get(("missing",))) is None


def test_different_keys_do_not_collide(store):
    run(store.put(("a", "b"), {"v": 1}))
    assert run(store.get(("a",))) is None and run(store.get(("b", "a"))) is None


def test_values_expire(store, monkeypatch):
    now = [100.0]
    monkeypatch.setattr(shared.time, "monotonic", lambda: now[0])
    run(store.put(("a",), {"x": 1}))
    now[0] += 59
    assert run(store.get(("a",))) == {"x": 1}
    now[0] += 2
    assert run(store.get(("a",))) is None


def test_a_new_prompt_version_does_not_see_old_results(store, monkeypatch):
    run(store.put(("a",), {"x": 1}))
    monkeypatch.setattr(cache, "PROMPT_VERSION", "another-version")
    assert run(store.get(("a",))) is None


def test_a_different_model_does_not_see_old_results(store, monkeypatch):
    run(store.put(("a",), {"x": 1}))
    monkeypatch.setenv("NOVA_ALLOWED_MODELS", "another/model")
    monkeypatch.setenv("NOVA_GENERATE_MODEL", "another/model")
    assert run(store.get(("a",))) is None and llm.generate_model() == "another/model"


def test_it_can_be_switched_off(store, monkeypatch):
    run(store.put(("a",), {"x": 1}))
    monkeypatch.setenv("NOVA_CACHE", "off")
    assert run(store.get(("a",))) is None


def test_two_caches_keep_separate_results():
    courses, topics = ResultCache("course", 60), ResultCache("topic", 60)
    run(courses.put(("a",), {"from": "course"}))
    assert run(topics.get(("a",))) is None


def test_an_unreachable_store_means_a_miss_not_an_error(store, monkeypatch):
    class Down:
        async def get(self, key):
            raise shared.StateError("down")

        async def put(self, key, value, ttl_seconds):
            raise shared.StateError("down")

    monkeypatch.setattr(shared, "state", Down())
    run(store.put(("a",), {"x": 1}))
    assert run(store.get(("a",))) is None
