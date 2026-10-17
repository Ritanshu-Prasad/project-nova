from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

import limits
import shared
import usage
from limits import RateLimiter


def app_with(limiter: RateLimiter) -> TestClient:
    app = FastAPI()

    @app.get("/ping", dependencies=[Depends(limiter)])
    def ping():
        return "pong"

    return TestClient(app)


def test_requests_within_the_limit_pass():
    client = app_with(RateLimiter("test", calls=3, seconds=60))
    assert [client.get("/ping").status_code for _ in range(3)] == [200, 200, 200]


def test_the_request_over_the_limit_is_429_with_a_retry_time():
    client = app_with(RateLimiter("test", calls=2, seconds=60))
    client.get("/ping"), client.get("/ping")
    response = client.get("/ping")
    assert response.status_code == 429 and 1 <= int(response.headers["retry-after"]) <= 60


def test_the_limit_resets_after_the_window(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(shared.time, "monotonic", lambda: now[0])
    client = app_with(RateLimiter("test", calls=1, seconds=60))
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 429
    now[0] += 61
    assert client.get("/ping").status_code == 200


def test_each_client_has_its_own_allowance(monkeypatch):
    client = app_with(RateLimiter("test", calls=1, seconds=60))
    assert client.get("/ping", headers={"x-forwarded-for": "1.1.1.1"}).status_code == 200
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "true")
    assert client.get("/ping", headers={"x-forwarded-for": "2.2.2.2, 10.0.0.1"}).status_code == 200
    assert client.get("/ping", headers={"x-forwarded-for": "2.2.2.2"}).status_code == 429


def test_forwarded_addresses_are_ignored_unless_proxies_are_trusted():
    client = app_with(RateLimiter("test", calls=1, seconds=60))
    assert client.get("/ping", headers={"x-forwarded-for": "1.1.1.1"}).status_code == 200
    assert client.get("/ping", headers={"x-forwarded-for": "9.9.9.9"}).status_code == 429


def test_the_limit_can_be_switched_off(monkeypatch):
    monkeypatch.setenv("NOVA_RATE_LIMIT", "off")
    client = app_with(RateLimiter("test", calls=1, seconds=60))
    assert [client.get("/ping").status_code for _ in range(3)] == [200, 200, 200]


def test_an_unreachable_store_does_not_block_requests(monkeypatch):
    class Down:
        async def hit(self, key, window):
            raise shared.StateError("down")

    monkeypatch.setattr(shared, "state", Down())
    client = app_with(RateLimiter("test", calls=1, seconds=60))
    assert [client.get("/ping").status_code for _ in range(3)] == [200, 200, 200]


def test_limits_with_different_names_count_separately():
    first, second = app_with(RateLimiter("one", calls=1, seconds=60)), app_with(RateLimiter("two", calls=1, seconds=60))
    assert (first.get("/ping").status_code, second.get("/ping").status_code) == (200, 200)


# --- Wired into the routes ---

def test_the_course_route_is_limited(client, fake_model, monkeypatch):
    monkeypatch.setattr(limits.COURSE_LIMIT, "calls", 1)
    first = client.post("/api/courses/generate", data={"mode": "goal", "level": "beginner", "objective": "Docker"})
    second = client.post("/api/courses/generate", data={"mode": "goal", "level": "beginner", "objective": "Docker"})
    assert (first.status_code, second.status_code) == (200, 429)


def test_every_denied_request_is_counted_for_the_ledger():
    client = app_with(RateLimiter("test", calls=1, seconds=60))
    for _ in range(3):
        client.get("/ping")
    import asyncio

    assert asyncio.run(usage.daily_report(1, []))[0]["events"] == {"limit_denied:test": 2}
