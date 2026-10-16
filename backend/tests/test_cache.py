import cache
from cache import TtlCache


def test_a_stored_value_is_returned():
    store = TtlCache(ttl_seconds=60, max_items=5)
    store.set("a", 1)
    assert store.get("a") == 1


def test_an_unknown_key_returns_nothing():
    assert TtlCache(60, 5).get("missing") is None


def test_values_expire(monkeypatch):
    now = [100.0]
    monkeypatch.setattr(cache.time, "monotonic", lambda: now[0])
    store = TtlCache(ttl_seconds=60, max_items=5)
    store.set("a", 1)
    now[0] += 59
    assert store.get("a") == 1
    now[0] += 2
    assert store.get("a") is None and "a" not in store.items


def test_the_oldest_value_is_dropped_when_full():
    store = TtlCache(60, max_items=2)
    for key in ("a", "b", "c"):
        store.set(key, key)
    assert [store.get(key) for key in ("a", "b", "c")] == [None, "b", "c"]


def test_it_can_be_switched_off(monkeypatch):
    store = TtlCache(60, 5)
    store.set("a", 1)
    monkeypatch.setenv("NOVA_CACHE", "off")
    assert store.get("a") is None


def test_clear_forgets_everything():
    store = TtlCache(60, 5)
    store.set("a", 1)
    store.clear()
    assert store.get("a") is None
