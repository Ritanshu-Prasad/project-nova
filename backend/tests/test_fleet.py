import asyncio
import json
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import accounts
import fleet

HEADERS = {"X-Nova": "1"}
VALID_PILOT = "0123456789abcdef0123456789abcdef"


@pytest.fixture
def client(tmp_path, monkeypatch):
    store = accounts.FileStore(tmp_path / "accounts.json")
    monkeypatch.setattr(accounts, "store", store)
    monkeypatch.setattr(fleet, "_last_submissions", {})
    app = FastAPI()
    app.include_router(fleet.router)
    return TestClient(app, raise_server_exceptions=False)


def test_fleet_score_and_leaderboard(client):
    body = {
        "pilotId": VALID_PILOT,
        "callsign": "Maverick",
        "color": "#06b6d4",
        "xp": 1500,
        "courses": [{"key": "intro-ai", "title": "Intro to AI", "mmr": 1200}],
    }
    res = client.post("/api/fleet/score", json=body, headers=HEADERS)
    assert res.status_code == 200
    assert res.json() == {"ok": True}

    board = client.get(f"/api/fleet/leaderboard?board=global&pilot={VALID_PILOT}").json()
    assert board["pilots"] == 1
    assert board["top"][0]["callsign"] == "Maverick"
    assert board["top"][0]["score"] == 1500
    assert board["you"]["score"] == 1500


def test_fleet_score_throttling(client):
    body = {
        "pilotId": VALID_PILOT,
        "callsign": "Goose",
        "xp": 100,
    }
    res1 = client.post("/api/fleet/score", json=body, headers=HEADERS)
    assert res1.status_code == 200

    # Immediate second submission should be throttled
    body["xp"] = 200
    res2 = client.post("/api/fleet/score", json=body, headers=HEADERS)
    assert res2.status_code == 429
    assert "Submitting too fast" in res2.text


def test_fleet_score_anti_cheat_initial_xp(client):
    body = {
        "pilotId": VALID_PILOT,
        "callsign": "Cheater",
        "xp": 50001,
    }
    res = client.post("/api/fleet/score", json=body, headers=HEADERS)
    assert res.status_code == 400
    assert "Initial XP exceeds maximum allowed delta" in res.text


def test_fleet_score_anti_cheat_xp_jump(client, monkeypatch):
    body = {
        "pilotId": VALID_PILOT,
        "callsign": "Iceman",
        "xp": 2000,
    }
    res1 = client.post("/api/fleet/score", json=body, headers=HEADERS)
    assert res1.status_code == 200

    # Advance throttle so we don't hit 429
    monkeypatch.setattr(fleet, "_last_submissions", {})
    # Reset existing timestamp back by 10s
    board = json.loads(asyncio.run(accounts.store.get(fleet.BOARD_KEY)))
    pilot_hash = fleet._hash(VALID_PILOT)
    board[pilot_hash]["at"] -= 10000
    asyncio.run(accounts.store.set(fleet.BOARD_KEY, json.dumps(board)))

    # Jump XP by 51000 (2000 -> 53000)
    body["xp"] = 53000
    res2 = client.post("/api/fleet/score", json=body, headers=HEADERS)
    assert res2.status_code == 400
    assert "XP jump exceeds maximum allowed delta" in res2.text


def test_fleet_score_invalid_json(client):
    res = client.post("/api/fleet/score", content="{not_valid_json", headers={"X-Nova": "1", "Content-Type": "application/json"})
    assert res.status_code == 400
    assert "Invalid JSON" in res.text


def test_fleet_score_csrf_required(client):
    body = {"pilotId": VALID_PILOT, "callsign": "Viper", "xp": 100}
    res = client.post("/api/fleet/score", json=body)
    assert res.status_code == 403


def test_fleet_leaderboard_deduplicates_by_callsign(client, monkeypatch):
    pilot1 = "11111111111111111111111111111111"
    pilot2 = "22222222222222222222222222222222"
    res1 = client.post("/api/fleet/score", json={"pilotId": pilot1, "callsign": "aetheclipse", "xp": 1000}, headers=HEADERS)
    assert res1.status_code == 200

    monkeypatch.setattr(fleet, "_last_submissions", {})

    res2 = client.post("/api/fleet/score", json={"pilotId": pilot2, "callsign": "aetheclipse", "xp": 1150}, headers=HEADERS)
    assert res2.status_code == 200

    board = client.get(f"/api/fleet/leaderboard?board=global&pilot={pilot2}").json()
    assert board["pilots"] == 1
    assert len(board["top"]) == 1
    assert board["top"][0]["callsign"] == "aetheclipse"
    assert board["top"][0]["score"] == 1150
    assert board["top"][0]["me"] is True

def test_fleet_leaderboard_includes_avatar(client):
    pilot = "33333333333333333333333333333333"
    avatar_url = "https://lh3.googleusercontent.com/a/ACg8ocTestAvatar"
    res = client.post("/api/fleet/score", json={"pilotId": pilot, "callsign": "Phoenix", "avatar": avatar_url, "xp": 800}, headers=HEADERS)
    assert res.status_code == 200

    board = client.get(f"/api/fleet/leaderboard?board=global&pilot={pilot}").json()
    assert board["top"][0]["callsign"] == "Phoenix"
    assert board["top"][0]["avatar"] == avatar_url
