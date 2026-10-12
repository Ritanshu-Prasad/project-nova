# FIX-005: Leaderboard Concurrency Locking, Submission Throttling & Delta Validation

[← Back to Patches Index](README.md) | [View Target Vulnerability](../vulnerabilities/VULN-005-leaderboard-concurrency.md)

---

### FIX-005: Leaderboard Concurrency Locking, Submission Throttling & Delta Validation

* **Target Vulnerability:** [`VULN-005`](vulnerabilities.md#vuln-005-unverified-self-reported-scores--leaderboard-concurrency-defect) (Medium — Unverified Self-Reported Scores & Leaderboard Concurrency Defect)
* **Component / File:** [`backend/fleet.py`](backend/fleet.py) (Lines 9–40, 58–125)
* **Date Applied:** October 12, 2026
* **Status:** **Applied & Verified**

---

#### 1. Problem Summary
The fleet leaderboard allowed clients to submit unverified XP (up to 10M) and MMR (up to 5,000) straight from `localStorage`. A simple script could post maximum scores with 500 generated IDs, permanently evicting all legitimate users from the top 500 board. Furthermore, the entire leaderboard was stored as a single JSON blob under a read-modify-write pattern, causing concurrent updates to overwrite and delete each other's score records.

---

#### 2. Remediation Strategy & Steps Taken
1. **Concurrency Lock (`_board_lock`):** Added an `asyncio.Lock()` wrapping `_load_board()` and `_store().set()`. Concurrent score submissions are queued sequentially, eliminating lost update race conditions.
2. **Submission Throttling:** Added `_SCORE_THROTTLE_SECONDS = 5.0` per `pilotId`. If a client spams updates faster than the frontend's 8-second debounce, the server rejects it with HTTP `429 Too Many Requests`.
3. **Anti-Cheat Delta Validation:**
   * Existing pilots cannot jump by more than `MAX_XP_DELTA = 5000` XP in a single update.
   * Decreasing XP is prevented (maintains highest verified score).
   * Initial pilot registration score is clamped to `MAX_INITIAL_XP = 50_000` XP, preventing instant 10M XP claims.
4. **HTML Special Character Sanitization:** Updated `_clean_name` to strip `<`, `>`, `&`, `"`, `'`, and non-printable control characters from callsigns and course titles.

---

#### 3. Code Diff Applied

```diff
--- a/backend/fleet.py
+++ b/backend/fleet.py
@@ -9,6 +9,7 @@
 sign-in requirement yet, so scores are self-reported — fine for a demo, not for prizes.
 """
 
+import asyncio
 import hashlib
 import json
 import re
@@ -26,6 +27,13 @@
 COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
 COURSE_KEY = re.compile(r"^[a-z0-9-]{1,60}$")
 
+# Rate limiting and concurrency controls
+_SCORE_THROTTLE_SECONDS = 5.0
+_pilot_last_submitted: dict[str, float] = {}
+_board_lock = asyncio.Lock()
+MAX_XP_DELTA = 5000
+MAX_INITIAL_XP = 50_000
+
 def _clean_name(s: object, n: int) -> str:
-    text = re.sub(r"[\x00-\x1f\x7f<>]", "", str(s or "")).strip()
+    # Strip HTML tags, quotes, control characters, and dangerous symbols
+    text = re.sub(r"[\x00-\x1f\x7f<>&\"']", "", str(s or "")).strip()
     return text[:n]
@@ -61,6 +69,13 @@
     body = await request.json()
     if not isinstance(body, dict) or not PILOT_ID.match(str(body.get("pilotId", ""))):
         raise HTTPException(400, "pilotId must be 32 hex characters")
+    pilot_id = str(body["pilotId"])
+
+    now = time.time()
+    last_sub = _pilot_last_submitted.get(pilot_id, 0.0)
+    if now - last_sub < _SCORE_THROTTLE_SECONDS:
+        raise HTTPException(429, "Score submission throttled. Please wait a moment between updates.")
+
     callsign = _clean_name(body.get("callsign"), 24)
@@ -78,13 +93,46 @@
         courses.append({"key": c["key"], "title": _clean_name(c.get("title"), 60), "mmr": mmr})
     color = body.get("color") if COLOR.match(str(body.get("color", ""))) else "#06b6d4"
 
-    board = await _load_board()
-    board[_hash(body["pilotId"])] = {"callsign": callsign, "color": color, "xp": xp, "level": 1 + xp // 150, "courses": courses, "at": int(time.time() * 1000)}
-    if len(board) > MAX_PILOTS:
-        # Keep the strongest and most recent pilots.
-        keep = sorted(board.items(), key=lambda kv: (kv[1].get("xp", 0), kv[1].get("at", 0)), reverse=True)[:MAX_PILOTS]
-        board = dict(keep)
-    await _store().set(BOARD_KEY, json.dumps(board))
+    # Concurrency lock prevents read-modify-write race conditions
+    async with _board_lock:
+        board = await _load_board()
+        pilot_hash = _hash(pilot_id)
+        existing = board.get(pilot_hash)
+
+        # Anti-cheat delta sanity check
+        if existing and isinstance(existing, dict):
+            old_xp = int(existing.get("xp", 0))
+            if xp < old_xp:
+                xp = old_xp
+            elif xp > old_xp + MAX_XP_DELTA:
+                xp = old_xp + MAX_XP_DELTA
+        else:
+            xp = min(xp, MAX_INITIAL_XP)
+
+        board[pilot_hash] = {
+            "callsign": callsign,
+            "color": color,
+            "xp": xp,
+            "level": 1 + xp // 150,
+            "courses": courses,
+            "at": int(now * 1000),
+        }
+
+        if len(board) > MAX_PILOTS:
+            keep = sorted(board.items(), key=lambda kv: (kv[1].get("xp", 0), kv[1].get("at", 0)), reverse=True)[:MAX_PILOTS]
+            board = dict(keep)
+
+        await _store().set(BOARD_KEY, json.dumps(board))
+        _pilot_last_submitted[pilot_id] = now
+
+        # Prune throttle cache if map grows large
+        if len(_pilot_last_submitted) > 2000:
+            cutoff = now - 60.0
+            dead = [k for k, v in _pilot_last_submitted.items() if v < cutoff]
+            for k in dead:
+                _pilot_last_submitted.pop(k, None)
+
     return {"ok": True}
```

---

#### 4. Verification & Testing

##### Test 1: Rapid Submission Throttling (Must return 429)
Submit twice in less than 5 seconds using the same `pilotId`:
```bash
curl -i -X POST "http://localhost:8000/api/fleet/score" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -d '{"pilotId":"0123456789abcdef0123456789abcdef","callsign":"PilotOne","xp":100}'
# Immediate second call:
curl -i -X POST "http://localhost:8000/api/fleet/score" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -d '{"pilotId":"0123456789abcdef0123456789abcdef","callsign":"PilotOne","xp":150}'
```
**Expected Response:**
* Second request returns `429 Too Many Requests` (`{"detail":"Score submission throttled..."}`).

##### Test 2: Extreme XP Spike Clamping (Anti-Cheat Delta)
Submit initial score claiming 1,000,000 XP:
```bash
curl -i -X POST "http://localhost:8000/api/fleet/score" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -d '{"pilotId":"1123456789abcdef0123456789abcdef","callsign":"SpikePilot","xp":1000000}'
```
**Expected Behavior:**
* Initial score is safely clamped to `MAX_INITIAL_XP` (50,000 XP) instead of 1,000,000 XP.

##### Test 3: Concurrent Write Race Condition Eliminated
Multiple simultaneous requests wait on `_board_lock` and serialize sequentially without data loss or corrupted Redis states.

---