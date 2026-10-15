# Issue 6: Global Fleet Leaderboard & Redis Anti-Cheat Validation

**Labels:** `backend`, `leaderboard`, `priority-low`  
**Target Files:** `backend/fleet.py`

---

## 🎯 Goal
Harden the global fleet leaderboard system (`POST /api/fleet/score`, `GET /api/fleet/leaderboard`), ensure Redis persistence in production, and add server-side sanity validation on submitted pilot scores.

---

## 📋 Problem Statement
The fleet leaderboard allows pilots to compare XP and MMR across courses. While the endpoints in `backend/fleet.py` are scaffolded, scores are currently self-reported by client browsers and rely on local file storage if Redis keys are not provided. 

Without server-side validation:
- A user could theoretically forge an HTTP POST payload with 1,000,000 XP or 5,000 MMR and instantly distort the leaderboard during a live demo.
- On serverless deployments, in-memory leaderboard standings reset.

---

## 🛠️ Required Technical Implementation

### 1. Redis Persistence (`backend/fleet.py`)
* Use `_store().get("nova:fleet:board")` and `_store().set(...)` to ensure entries survive across restarts.
* Cap total tracked pilots to top 500 to bound memory footprint.
* Return top 50 pilots sorted by `score` descending, with secondary sort by timestamp.

### 2. Anti-Cheat & Sanity Bounds
* When a pilot posts an updated score via `/api/fleet/score`:
  * Verify `pilotId` matches 32-character hexadecimal format.
  * Verify `callsign` length (between 2 and 24 characters, sanitized against control/HTML characters).
  * Check against previous score for that `pilotId`:
    * Maximum allowed XP gain in a single report: 1,500 XP.
    * Maximum allowed MMR per course: 5,000 MMR.
    * Rate-limit score submissions to at most once every 10 seconds per `pilotId`.

### 3. Filtered Leaderboard Queries
* Support `GET /api/fleet/leaderboard?board=global` for overall XP rankings.
* Support `GET /api/fleet/leaderboard?board=<courseKey>` for course-specific MMR ladders.
* Return `you`: the requesting pilot's exact current rank and score.

---

## ✅ Acceptance Criteria
- [ ] Pilot leaderboard ranks correctly update after passing quizzes in the frontend.
- [ ] Ridiculous or forged scores (>1,500 XP delta per post) are clamped or rejected.
- [ ] Leaderboard standings persist across server restarts when Upstash Redis is connected.
- [ ] Running `python -m py_compile backend/fleet.py` passes with zero errors.
