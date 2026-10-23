import bisect
import math
"""
Fleet leaderboard: every pilot's standing across the demo courses, so pilots can compare ranks.

  POST /api/fleet/score        {"pilotId", "callsign", "color", "xp", "courses": [{"key", "title", "mmr"}]}
  GET  /api/fleet/leaderboard  ?board=global|<course key>&pilot=<pilotId>  → top pilots + your position

The pilot id is a random secret kept in the pilot's browser; only a hash of it is stored, and it is never sent back.
Storage is the same as accounts (Upstash Redis in production, a local file in development). There is no
sign-in requirement yet, so scores are self-reported — fine for a demo, not for prizes.
"""

import hashlib
import json
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Request

from accounts import _store
from security import ScoreConcurrencyGuard, require_csrf

router = APIRouter()

BOARD_KEY = "nova:fleet:board"
MAX_PILOTS = 500
TOP = 50
PILOT_ID = re.compile(r"^[a-f0-9]{32}$")
COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
COURSE_KEY = re.compile(r"^[a-z0-9-]{1,60}$")
MAX_XP_DELTA = 50_000
SUBMISSION_THROTTLE_SECONDS = 5.0

LEVEL_THRESHOLDS = [0]
_total = 0
for _lvl in range(1, 151):
    _total += round(100 * (1.08 ** (_lvl - 1)))
    LEVEL_THRESHOLDS.append(_total)


def level_of(xp: int) -> int:
    """Calculates pilot level with a gentle exponential curve."""
    if xp <= 0:
        return 1
    return bisect.bisect_right(LEVEL_THRESHOLDS, xp)


guard = ScoreConcurrencyGuard(max_delta=5000)  # lock + per-submission XP clamp + string sanitizing
_last_submissions: dict[str, float] = {}


def _hash(pilot_id: str) -> str:
    return hashlib.sha256(pilot_id.encode()).hexdigest()[:16]


def _clean_name(s: object, n: int) -> str:
    return guard.sanitize_string(s, n)


async def _load_board() -> dict:
    raw = await _store().get(BOARD_KEY)
    try:
        board = json.loads(raw) if raw else {}
    except ValueError:
        board = {}
    return board if isinstance(board, dict) else {}


@router.post("/api/fleet/score", dependencies=[Depends(require_csrf)])
async def post_score(request: Request):
    try:
        body = await request.json()
    except (ValueError, json.JSONDecodeError):
        raise HTTPException(400, "Invalid JSON")
    if not isinstance(body, dict) or not PILOT_ID.match(str(body.get("pilotId", ""))):
        raise HTTPException(400, "pilotId must be 32 hex characters")
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
    raw_avatar = str(body.get("avatar", "") or "").strip()
    avatar = ""
    if (raw_avatar.startswith("https://") or raw_avatar.startswith("data:image/")) and len(raw_avatar) <= 65_536:
        avatar = raw_avatar

    pilot_hash = _hash(body["pilotId"])

    async with guard.lock:
        now = time.time()
        if now - _last_submissions.get(pilot_hash, 0.0) < SUBMISSION_THROTTLE_SECONDS:
            raise HTTPException(429, "Submitting too fast; please wait 5 seconds")

        board = await _load_board()
        callsign_lower = callsign.lower()

        # Deduplicate: if an entry with this callsign already exists under another hash, remove older stale ones
        prev_xp = 0
        merged_courses = {c["key"]: c for c in courses}
        for h, e in list(board.items()):
            if e.get("callsign", "").strip().lower() == callsign_lower:
                prev_xp = max(prev_xp, int(e.get("xp", 0) or 0))
                if not avatar and e.get("avatar"):
                    avatar = e.get("avatar")
                for c in e.get("courses", []):
                    if c.get("key") not in merged_courses:
                        merged_courses[c["key"]] = c
                if h != pilot_hash:
                    del board[h]

        existing = board.get(pilot_hash)
        if existing:
            if not avatar and existing.get("avatar"):
                avatar = existing.get("avatar")
            prev_at = float(existing.get("at", 0) or 0) / 1000.0
            if prev_at > 0 and 0 <= (now - prev_at) < SUBMISSION_THROTTLE_SECONDS:
                raise HTTPException(429, "Submitting too fast; please wait 5 seconds")
            prev_xp = max(prev_xp, int(existing.get("xp", 0) or 0))
            if xp - prev_xp > MAX_XP_DELTA:
                raise HTTPException(400, f"XP jump exceeds maximum allowed delta ({MAX_XP_DELTA})")
        else:
            if xp - prev_xp > MAX_XP_DELTA:
                raise HTTPException(400, f"Initial XP exceeds maximum allowed delta ({MAX_XP_DELTA})")

        final_xp = guard.clamp_delta(prev_xp if (existing or prev_xp) else None, xp)
        board[pilot_hash] = {
            "callsign": callsign,
            "avatar": avatar,
            "color": color,
            "xp": final_xp,
            "level": level_of(final_xp),
            "courses": list(merged_courses.values()),
            "at": int(now * 1000),
        }
        if len(board) > MAX_PILOTS:
            # Keep the strongest and most recent pilots.
            keep = sorted(board.items(), key=lambda kv: (kv[1].get("xp", 0), kv[1].get("at", 0)), reverse=True)[:MAX_PILOTS]
            board = dict(keep)
        await _store().set(BOARD_KEY, json.dumps(board))

        _last_submissions[pilot_hash] = now
        if len(_last_submissions) > 5000:
            cutoff = now - 60.0
            for k in [k for k, v in _last_submissions.items() if v < cutoff]:
                _last_submissions.pop(k, None)

        return {"ok": True}


@router.get("/api/fleet/leaderboard")
async def leaderboard(board: str = "global", pilot: str = ""):
    if board != "global" and not COURSE_KEY.match(board):
        raise HTTPException(400, "Unknown board")
    entries = await _load_board()
    me = _hash(pilot) if PILOT_ID.match(pilot) else None
    # Deduplicate entries by callsign so each user appears exactly once
    deduped = {}
    for key, e in entries.items():
        c_name = e.get("callsign", "Pilot").strip()
        c_key = c_name.lower()
        if board == "global":
            score = e.get("xp", 0)
        else:
            course = next((c for c in e.get("courses", []) if c.get("key") == board), None)
            if not course:
                continue
            score = course.get("mmr", 0)

        row = {
            "key": key,
            "callsign": c_name,
            "avatar": e.get("avatar", ""),
            "color": e.get("color", "#06b6d4"),
            "level": level_of(int(e.get("xp", 0) or 0)),
            "score": score,
            "at": e.get("at", 0),
            "courses": e.get("courses", []),
        }

        if c_key not in deduped:
            deduped[c_key] = row
        else:
            prev = deduped[c_key]
            if not row["avatar"] and prev.get("avatar"):
                row["avatar"] = prev["avatar"]
            if row["score"] > prev["score"]:
                if prev["key"] == me:
                    row["key"] = me
                deduped[c_key] = row
            elif prev["key"] != me and key == me:
                prev["key"] = me
            prev_course_keys = {c.get("key") for c in prev["courses"]}
            for c in row["courses"]:
                if c.get("key") not in prev_course_keys:
                    prev["courses"].append(c)

    rows = list(deduped.values())
    rows.sort(key=lambda r: (r["score"], -r["at"]), reverse=True)
    you = next(({"rank": i + 1, "score": r["score"]} for i, r in enumerate(rows) if r["key"] == me), None)
    top = [{**{k: v for k, v in r.items() if k not in ("key", "at", "courses")}, "rank": i + 1, "me": r["key"] == me} for i, r in enumerate(rows[:TOP])]
    return {"board": board, "pilots": len(rows), "top": top, "you": you}
