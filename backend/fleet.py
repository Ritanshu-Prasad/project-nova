"""
Fleet leaderboard: every pilot's standing across the demo courses, so pilots can compare ranks.

  POST /api/fleet/score        {"pilotId", "callsign", "color", "xp", "courses": [{"key", "title", "mmr"}]}
  GET  /api/fleet/leaderboard  ?board=global|<course key>&pilot=<pilotId>  → top pilots + your position

The pilot id is a random secret kept in the pilot's browser; only a hash of it is stored, and it is never sent back.
Storage is the same as accounts (Upstash Redis in production, a local file in development). There is no
sign-in requirement yet, so scores are self-reported — fine for a demo, not for prizes.
"""

import asyncio
import hashlib
import json
import re
import time

from fastapi import APIRouter, HTTPException, Request

from accounts import _require_csrf, _store

router = APIRouter()

BOARD_KEY = "nova:fleet:board"
MAX_PILOTS = 500
TOP = 50
PILOT_ID = re.compile(r"^[a-f0-9]{32}$")
COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
COURSE_KEY = re.compile(r"^[a-z0-9-]{1,60}$")

# Rate limiting and concurrency controls
_SCORE_THROTTLE_SECONDS = 5.0
_pilot_last_submitted: dict[str, float] = {}
_board_lock = asyncio.Lock()
MAX_XP_DELTA = 5000
MAX_INITIAL_XP = 50_000


def _hash(pilot_id: str) -> str:
    return hashlib.sha256(pilot_id.encode()).hexdigest()[:16]


def _clean_name(s: object, n: int) -> str:
    # Strip HTML tags, quotes, control characters, and dangerous symbols
    text = re.sub(r"[\x00-\x1f\x7f<>&\"']", "", str(s or "")).strip()
    return text[:n]


async def _load_board() -> dict:
    raw = await _store().get(BOARD_KEY)
    try:
        board = json.loads(raw) if raw else {}
    except ValueError:
        board = {}
    return board if isinstance(board, dict) else {}


@router.post("/api/fleet/score")
async def post_score(request: Request):
    _require_csrf(request)
    body = await request.json()
    if not isinstance(body, dict) or not PILOT_ID.match(str(body.get("pilotId", ""))):
        raise HTTPException(400, "pilotId must be 32 hex characters")
    pilot_id = str(body["pilotId"])

    now = time.time()
    last_sub = _pilot_last_submitted.get(pilot_id, 0.0)
    if now - last_sub < _SCORE_THROTTLE_SECONDS:
        raise HTTPException(429, "Score submission throttled. Please wait a moment between updates.")

    callsign = _clean_name(body.get("callsign"), 24)
    if len(callsign) < 2:
        raise HTTPException(400, "callsign is required")
    try:
        xp = max(0, min(10_000_000, int(body.get("xp", 0))))
    except (TypeError, ValueError):
        raise HTTPException(400, "xp must be a number")
    courses = []
    for c in (body.get("courses") or [])[:10]:
        if not isinstance(c, dict) or not COURSE_KEY.match(str(c.get("key", ""))):
            continue
        try:
            mmr = max(0, min(5000, int(c.get("mmr", 0))))
        except (TypeError, ValueError):
            continue
        courses.append({"key": c["key"], "title": _clean_name(c.get("title"), 60), "mmr": mmr})
    color = body.get("color") if COLOR.match(str(body.get("color", ""))) else "#06b6d4"

    # Concurrency lock prevents read-modify-write race conditions
    async with _board_lock:
        board = await _load_board()
        pilot_hash = _hash(pilot_id)
        existing = board.get(pilot_hash)

        # Anti-cheat delta sanity check
        if existing and isinstance(existing, dict):
            old_xp = int(existing.get("xp", 0))
            if xp < old_xp:
                xp = old_xp
            elif xp > old_xp + MAX_XP_DELTA:
                xp = old_xp + MAX_XP_DELTA
        else:
            xp = min(xp, MAX_INITIAL_XP)

        board[pilot_hash] = {
            "callsign": callsign,
            "color": color,
            "xp": xp,
            "level": 1 + xp // 150,
            "courses": courses,
            "at": int(now * 1000),
        }

        if len(board) > MAX_PILOTS:
            # Keep the strongest and most recent pilots.
            keep = sorted(board.items(), key=lambda kv: (kv[1].get("xp", 0), kv[1].get("at", 0)), reverse=True)[:MAX_PILOTS]
            board = dict(keep)

        await _store().set(BOARD_KEY, json.dumps(board))
        _pilot_last_submitted[pilot_id] = now

        # Prune throttle cache if map grows large
        if len(_pilot_last_submitted) > 2000:
            cutoff = now - 60.0
            dead = [k for k, v in _pilot_last_submitted.items() if v < cutoff]
            for k in dead:
                _pilot_last_submitted.pop(k, None)

    return {"ok": True}


@router.get("/api/fleet/leaderboard")
async def leaderboard(board: str = "global", pilot: str = ""):
    if board != "global" and not COURSE_KEY.match(board):
        raise HTTPException(400, "Unknown board")
    entries = await _load_board()
    me = _hash(pilot) if PILOT_ID.match(pilot) else None
    rows = []
    for key, e in entries.items():
        if board == "global":
            score = e.get("xp", 0)
        else:
            course = next((c for c in e.get("courses", []) if c.get("key") == board), None)
            if not course:
                continue
            score = course.get("mmr", 0)
        rows.append({"key": key, "callsign": e.get("callsign", "Pilot"), "color": e.get("color", "#06b6d4"), "level": e.get("level", 1), "score": score, "at": e.get("at", 0)})
    rows.sort(key=lambda r: (r["score"], -r["at"]), reverse=True)
    you = next(({"rank": i + 1, "score": r["score"]} for i, r in enumerate(rows) if r["key"] == me), None)
    top = [{**{k: v for k, v in r.items() if k not in ("key", "at")}, "rank": i + 1, "me": r["key"] == me} for i, r in enumerate(rows[:TOP])]
    return {"board": board, "pilots": len(rows), "top": top, "you": you}
