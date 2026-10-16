import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

import limits
from limits import RateLimiter


def app_with(limiter: RateLimiter) -> TestClient:
    app = FastAPI()

    @app.get("/ping", dependencies=[Depends(limiter)])
    def ping():
        return "pong"

    return TestClient(app)


def test_requests_within_the_limit_pass():
    client = app_with(RateLimiter(calls=3, seconds=60))
    assert [client.get("/ping").status_code for _ in range(3)] == [200, 200, 200]


def test_the_request_over_the_limit_is_429_with_a_retry_time():
    client = app_with(RateLimiter(calls=2, seconds=60))
    client.get("/ping"), client.get("/ping")
    response = client.get("/ping")
    assert response.status_code == 429 and 1 <= int(response.headers["retry-after"]) <= 60


def test_the_limit_resets_after_the_window(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(limits.time, "monotonic", lambda: now[0])
    client = app_with(RateLimiter(calls=1, seconds=60))
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 429
    now[0] += 61
    assert client.get("/ping").status_code == 200


def test_each_client_has_its_own_allowance(monkeypatch):
    client = app_with(RateLimiter(calls=1, seconds=60))
    assert client.get("/ping", headers={"x-forwarded-for": "1.1.1.1"}).status_code == 200
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "true")
    assert client.get("/ping", headers={"x-forwarded-for": "2.2.2.2, 10.0.0.1"}).status_code == 200
    assert client.get("/ping", headers={"x-forwarded-for": "2.2.2.2"}).status_code == 429


def test_forwarded_addresses_are_ignored_unless_proxies_are_trusted():
    client = app_with(RateLimiter(calls=1, seconds=60))
    assert client.get("/ping", headers={"x-forwarded-for": "1.1.1.1"}).status_code == 200
    assert client.get("/ping", headers={"x-forwarded-for": "9.9.9.9"}).status_code == 429


def test_the_limit_can_be_switched_off(monkeypatch):
    monkeypatch.setenv("NOVA_RATE_LIMIT", "off")
    client = app_with(RateLimiter(calls=1, seconds=60))
    assert [client.get("/ping").status_code for _ in range(3)] == [200, 200, 200]


def test_idle_clients_are_forgotten_when_too_many_are_tracked(monkeypatch):
    monkeypatch.setattr(limits, "MAX_TRACKED_CLIENTS", 2)
    limiter = RateLimiter(calls=5, seconds=60)
    for name in ("a", "b", "c"):
        limiter.hits[name].append(0.0)
    limiter._recent("d", now=1000.0)
    assert set(limiter.hits) == {"d"}


# --- Wired into the routes ---

def test_the_course_route_is_limited(client, fake_model, monkeypatch):
    monkeypatch.setattr(limits.COURSE_LIMIT, "calls", 1)
    first = client.post("/api/courses/generate", data={"mode": "goal", "level": "beginner", "objective": "Docker"})
    second = client.post("/api/courses/generate", data={"mode": "goal", "level": "beginner", "objective": "Docker"})
    assert (first.status_code, second.status_code) == (200, 429)
