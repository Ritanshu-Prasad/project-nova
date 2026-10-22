
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import admin
import events
import limits

TOKEN = "s3cret-token"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("NOVA_ADMIN_TOKEN", TOKEN)
    app = FastAPI()
    app.include_router(events.router)
    app.include_router(admin.router)
    return TestClient(app)


def today_events(client) -> dict:
    return client.get("/api/admin/usage?days=1", headers={"Authorization": f"Bearer {TOKEN}"}).json()["days"][0]["events"]


@pytest.mark.parametrize("step", events.FUNNEL)
def test_each_step_of_the_journey_is_counted(client, step):
    assert client.post("/api/events", json={"event": step}).json() == {"counted": True}
    assert today_events(client)[f"funnel:{step}"] == 1


def test_steps_add_up_over_the_day(client):
    for _ in range(3):
        client.post("/api/events", json={"event": "topic_finished"})
    assert today_events(client)["funnel:topic_finished"] == 3


@pytest.mark.parametrize("bad", [{"event": "anything_else"}, {}, {"event": ""}])
def test_only_the_known_steps_are_accepted(client, bad):
    assert client.post("/api/events", json=bad).status_code == 422


def test_nothing_but_the_name_is_stored(client):
    client.post("/api/events", json={"event": "course_started", "course": "Docker", "user": "someone"}, headers={"x-forwarded-for": "9.9.9.9"})
    assert set(today_events(client)) == {"funnel:course_started"}


def test_events_are_limited_per_address(client, monkeypatch):
    monkeypatch.setattr(limits.FEEDBACK_LIMIT, "anonymous_calls", 2)
    codes = [client.post("/api/events", json={"event": "course_started"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_the_page_shows_where_learners_get_to(client):
    page = client.get("/api/admin").text
    assert "Where learners get to" in page and "funnel:" in page


def test_the_funnel_steps_are_the_ones_the_model_allows():
    assert set(events.FUNNEL) == set(events.UsageEvent.model_fields["event"].annotation.__args__)
