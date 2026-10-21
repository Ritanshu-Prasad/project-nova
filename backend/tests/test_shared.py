import asyncio

import httpx
import pytest

import shared
from shared import MemoryState, RedisState, StateError


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def clock(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(shared.time, "monotonic", lambda: now[0])
    return now


# --- In memory ---

def test_hits_are_counted_within_a_window(clock):
    state = MemoryState()
    assert [run(state.hit("k", 60)) for _ in range(3)] == [1, 2, 3]


def test_a_new_window_starts_counting_again(clock):
    state = MemoryState()
    run(state.hit("k", 60)), run(state.hit("k", 60))
    clock[0] += 61
    assert run(state.hit("k", 60)) == 1


def test_the_window_does_not_move_with_later_hits(clock):
    state = MemoryState()
    run(state.hit("k", 60))
    clock[0] += 50
    run(state.hit("k", 60))
    assert run(state.ttl("k")) == 10


def test_amounts_can_be_added_to_a_counter(clock):
    state = MemoryState()
    assert [run(state.add("k", amount, 60)) for amount in (500, 250, 1)] == [500, 750, 751]
    clock[0] += 61
    assert run(state.add("k", 5, 60)) == 5


def test_counters_are_separate_per_key(clock):
    state = MemoryState()
    run(state.hit("a", 60))
    assert run(state.hit("b", 60)) == 1


def test_values_are_stored_until_they_expire(clock):
    state = MemoryState()
    run(state.put("k", "v", 30))
    assert run(state.get("k")) == "v"
    clock[0] += 31
    assert run(state.get("k")) is None


def test_a_value_can_be_deleted(clock):
    state = MemoryState()
    run(state.put("k", "v", 30))
    run(state.delete("k"))
    assert run(state.get("k")) is None


def test_the_remaining_time_of_an_unknown_key_is_zero(clock):
    assert run(MemoryState().ttl("nothing")) == 0


def test_expired_entries_are_forgotten_when_too_many_are_kept(clock, monkeypatch):
    monkeypatch.setattr(shared, "MAX_LOCAL_KEYS", 2)
    state = MemoryState()
    run(state.put("old1", "x", 10)), run(state.put("old2", "x", 10))
    clock[0] += 20
    run(state.put("new", "x", 10))
    assert set(state.entries) == {"new"}


def test_named_counters_are_added_together_under_one_key(clock):
    state = MemoryState()
    run(state.hincr_many("day", {"lesson:calls": 1, "lesson:prompt": 500}, 60))
    run(state.hincr_many("day", {"lesson:calls": 1, "quiz:calls": 1}, 60))
    assert run(state.hgetall("day")) == {"lesson:calls": 2, "lesson:prompt": 500, "quiz:calls": 1}


def test_a_key_of_counters_expires_after_its_first_write(clock):
    state = MemoryState()
    run(state.hincr_many("day", {"a": 1}, 60))
    clock[0] += 30
    run(state.hincr_many("day", {"a": 1}, 60))
    clock[0] += 31
    assert run(state.hgetall("day")) == {}


def test_an_unknown_key_of_counters_is_empty(clock):
    assert run(MemoryState().hgetall("nothing")) == {}


def test_clearing_forgets_counters_too(clock):
    state = MemoryState()
    run(state.hincr_many("day", {"a": 1}, 60))
    state.clear()
    assert run(state.hgetall("day")) == {}


# --- Redis ---

class FakeRedis:
    """Answers Upstash REST commands from a dictionary and records them."""

    def __init__(self):
        self.data, self.commands, self.hashes, self.lists = {}, [], {}, {}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        import json

        command = json.loads(request.content)
        if request.url.path.endswith("/pipeline"):
            self.commands.append(["PIPELINE", len(command)])
            return httpx.Response(200, json=[self(self._single(request, step)).json() for step in command])
        self.commands.append(command)
        name, key, *rest = command
        if name == "INCRBY":
            self.data[key] = int(self.data.get(key, 0)) + int(rest[0])
            return httpx.Response(200, json={"result": self.data[key]})
        if name == "GET":
            return httpx.Response(200, json={"result": self.data.get(key)})
        if name == "SET":
            self.data[key] = rest[0]
            return httpx.Response(200, json={"result": "OK"})
        if name == "DEL":
            self.data.pop(key, None)
            return httpx.Response(200, json={"result": 1})
        if name == "HINCRBY":
            self.hashes.setdefault(key, {})
            self.hashes[key][rest[0]] = self.hashes[key].get(rest[0], 0) + int(rest[1])
            return httpx.Response(200, json={"result": self.hashes[key][rest[0]]})
        if name == "HGETALL":
            flat = [item for pair in self.hashes.get(key, {}).items() for item in (pair[0], str(pair[1]))]
            return httpx.Response(200, json={"result": flat})
        if name == "LPUSH":
            self.lists.setdefault(key, []).insert(0, rest[0])
            return httpx.Response(200, json={"result": len(self.lists[key])})
        if name == "LTRIM":
            self.lists[key] = self.lists[key][: int(rest[1]) + 1]
            return httpx.Response(200, json={"result": "OK"})
        if name == "LRANGE":
            return httpx.Response(200, json={"result": self.lists.get(key, [])[int(rest[0]): int(rest[1]) + 1]})
        if name == "TTL":
            return httpx.Response(200, json={"result": 42})
        return httpx.Response(200, json={"result": 1})


def _single(self, request: httpx.Request, step: list) -> httpx.Request:
    return httpx.Request("POST", "https://redis.test/", content=__import__("json").dumps(step).encode())


FakeRedis._single = _single


@pytest.fixture
def redis(monkeypatch):
    fake = FakeRedis()
    real_client = httpx.AsyncClient
    monkeypatch.setattr(shared.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(fake), **kw))
    return RedisState("https://redis.test/", "token"), fake


def test_the_first_hit_sets_the_expiry(redis):
    state, fake = redis
    assert run(state.hit("k", 60)) == 1
    assert ["EXPIRE", "k", "60"] in fake.commands


def test_amounts_are_added_and_the_expiry_is_set_once(redis):
    state, fake = redis
    assert run(state.add("k", 500, 3600)) == 500 and run(state.add("k", 250, 3600)) == 750
    assert ["INCRBY", "k", "500"] in fake.commands and sum(command[0] == "EXPIRE" for command in fake.commands) == 1


def test_later_hits_do_not_move_the_expiry(redis):
    state, fake = redis
    run(state.hit("k", 60)), run(state.hit("k", 60))
    assert sum(command[0] == "EXPIRE" for command in fake.commands) == 1


def test_redis_values_round_trip(redis):
    state, fake = redis
    run(state.put("k", "v", 30))
    assert ["SET", "k", "v", "EX", "30"] in fake.commands and run(state.get("k")) == "v"
    run(state.delete("k"))
    assert run(state.get("k")) is None


def test_named_counters_go_to_redis_in_one_request_with_an_expiry_that_is_not_moved(redis):
    state, fake = redis
    run(state.hincr_many("day", {"lesson:calls": 1, "lesson:prompt": 500}, 3600))
    assert fake.commands[0] == ["PIPELINE", 3] and fake.hashes["day"] == {"lesson:calls": 1, "lesson:prompt": 500}


def test_counters_read_back_as_numbers(redis):
    state, fake = redis
    run(state.hincr_many("day", {"a": 2, "b": 3}, 60))
    assert run(state.hgetall("day")) == {"a": 2, "b": 3} and run(state.hgetall("nothing")) == {}


def test_the_remaining_time_comes_from_redis(redis):
    assert run(redis[0].ttl("k")) == 42


def test_redis_requests_carry_the_token(monkeypatch):
    seen = []
    real_client = httpx.AsyncClient

    def handler(request):
        seen.append(request.headers["authorization"])
        return httpx.Response(200, json={"result": None})

    monkeypatch.setattr(shared.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    run(RedisState("https://redis.test", "secret").get("k"))
    assert seen == ["Bearer secret"]


def test_a_redis_error_status_becomes_a_state_error(monkeypatch):
    real_client = httpx.AsyncClient
    monkeypatch.setattr(shared.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(lambda request: httpx.Response(500)), **kw))
    with pytest.raises(StateError):
        run(RedisState("https://redis.test", "t").get("k"))


def test_an_unreachable_redis_becomes_a_state_error(monkeypatch):
    def refuse(request):
        raise httpx.ConnectError("down")

    real_client = httpx.AsyncClient
    monkeypatch.setattr(shared.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(refuse), **kw))
    with pytest.raises(StateError):
        run(RedisState("https://redis.test", "t").hit("k", 60))


# --- Choosing the store ---

def test_memory_is_used_without_redis_settings(monkeypatch):
    for name in ("KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"):
        monkeypatch.delenv(name, raising=False)
    assert isinstance(shared.make_state(), MemoryState)


def test_redis_is_used_when_configured_either_way(monkeypatch):
    monkeypatch.setenv("UPSTASH_REDIS_REST_URL", "https://redis.test")
    monkeypatch.setenv("UPSTASH_REDIS_REST_TOKEN", "t")
    assert isinstance(shared.make_state(), RedisState)


# --- Lists of recent items ---

def test_the_newest_items_come_first_and_only_the_cap_is_kept(clock):
    state = MemoryState()
    for number in range(5):
        run(state.push_capped("traces", f"item{number}", 3, 60))
    assert run(state.recent("traces", 10)) == ["item4", "item3", "item2"]


def test_a_list_can_be_read_in_part_and_an_unknown_one_is_empty(clock):
    state = MemoryState()
    run(state.push_capped("traces", "a", 5, 60)), run(state.push_capped("traces", "b", 5, 60))
    assert run(state.recent("traces", 1)) == ["b"] and run(state.recent("nothing", 5)) == []


def test_a_list_expires_after_its_first_write_and_starts_again(clock):
    state = MemoryState()
    run(state.push_capped("traces", "old", 5, 60))
    clock[0] += 30
    run(state.push_capped("traces", "mid", 5, 60))
    clock[0] += 31
    assert run(state.recent("traces", 5)) == []
    run(state.push_capped("traces", "new", 5, 60))
    assert run(state.recent("traces", 5)) == ["new"]


def test_redis_keeps_the_newest_items_with_one_request_and_an_expiry_that_is_not_moved(redis):
    state, fake = redis
    for number in range(4):
        run(state.push_capped("traces", f"item{number}", 3, 3600))
    assert fake.commands[0] == ["PIPELINE", 3] and ["LTRIM", "traces", "0", "2"] in fake.commands
    assert run(state.recent("traces", 2)) == ["item3", "item2"] and run(state.recent("nothing", 2)) == []
