# VULN-005: Unverified Self-Reported Scores & Leaderboard Concurrency Defect

[← Back to Vulnerability Index](README.md) | [View Patch in Patches](../patches/FIX-005-leaderboard-locks-throttling.md)

---

### VULN-005: Unverified Self-Reported Scores & Leaderboard Concurrency Defect

* **Severity:** **Medium** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:M - Base Score: 6.5)
* **Category:** Trusting Untrusted Inputs for Security Decisions / Race Condition / Competitive Integrity Collapse (CWE-807, CWE-362, CWE-400)
* **Affected Files:**
  * [`backend/fleet.py`](backend/fleet.py) (Lines 40–82)
  * [`frontend/src/core/fleet.ts`](frontend/src/core/fleet.ts) (Lines 50–70)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-005-leaderboard-concurrency-locking-submission-throttling--delta-validation))

#### 1. Vulnerability Description & Root Cause
Project Nova features a fleet leaderboard where pilots compete globally and across courses using XP and MMR metrics. In `backend/fleet.py`, two severe architectural flaws existed:

1. **Unverified Client-Reported Scores (Lack of Anti-Cheat):**
   The endpoint `POST /api/fleet/score` accepted `xp` (up to 10,000,000) and `mmr` (up to 5,000) calculated entirely on the client side in browser `localStorage`. There was no server-side evaluation of whether questions were answered correctly or quizzes completed.
2. **Leaderboard Eviction Denial of Service:**
   The leaderboard capped entries at 500 pilots (`MAX_PILOTS = 500`), evicting lower-scoring pilots when the capacity was exceeded. An automated script could submit 500 fake pilots with maximum XP, permanently evicting all legitimate users.
3. **Read-Modify-Write Concurrency Defect:**
   The entire leaderboard was stored as a single monolithic JSON string under `nova:fleet:board`. When updating a score, the backend fetched the entire board, deserialized it in Python memory, modified the entry, and re-serialized it back to Redis. If two pilots submitted scores concurrently, the second save completely overwrote the first save, causing lost score updates and rank corruption.
4. **Missing Submission Throttling:**
   There was no rate limit on score posts, allowing bot scripts to spam updates continuously.

#### 2. Attack Vectors & Exploitation Scenarios
* **Scenario A: Instant #1 Rank via Single Curl Request:** A user opens DevTools or runs a curl command posting `xp: 10000000` and `mmr: 5000`. The server blindly persists the score, immediately giving the user #1 rank globally and across all courses.
* **Scenario B: Board Poisoning & User Eviction DoS:** An adversary runs a script creating 500 random 32-hex pilot IDs with 10M XP. Within seconds, every genuine pilot is evicted from the top 500 board.
* **Scenario C: Lost Updates During Live Demos:** Multiple judges or evaluators testing the application simultaneously trigger concurrent score posts. The race condition silently discards submissions, showing incorrect or stagnant scores on the UI.

#### 3. Impact on Project Nova
* Total collapse of gamification credibility and competitive integrity.
* Risk of lost progress and score desynchronization during multi-user testing.

---