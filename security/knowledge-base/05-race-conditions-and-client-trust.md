# 5. Unverified Self-Reported Scores & Leaderboard Concurrency Defect

[← Back to Knowledge Base Index](README.md) | [View Vulnerability](../vulnerabilities/VULN-005-leaderboard-concurrency.md) | [View Patch](../patches/FIX-005-leaderboard-locks-throttling.md)

---

## 5. Unverified Self-Reported Scores & Leaderboard Concurrency Defect

### High-Level Concept
In multiplayer or competitive web platforms, trusting the client browser to calculate and report its own XP, MMR, and rank creates an open invitation for manipulation. When coupled with a "Read-Modify-Write" pattern on a single serialized JSON storage key, concurrent updates collide, causing lost progress, data corruption, and denial of service.

### Key Points & Mechanics
* **Client-Authoritative Anti-Pattern:** The frontend calculates XP gains and MMR changes inside `localStorage` and sends them via `POST /api/fleet/score`. Because the backend had zero server-side verification of whether questions were answered correctly, any user could send a curl request claiming `10,000,000 XP` and `5,000 MMR`.
* **Leaderboard Eviction DoS:** The leaderboard maintains a hard cap of 500 pilots (`MAX_PILOTS = 500`), dropping the lowest-scoring pilots when full. An automated script could flood the endpoint with 500 fake pilots with maximum XP, permanently evicting all authentic pilots from the leaderboard.
* **The Read-Modify-Write Concurrency Defect:**
  ```python
  board = await _load_board() # Step 1: Read entire JSON
  board[pilot_hash] = new_score # Step 2: Modify in Python memory
  await _store().set(BOARD_KEY, json.dumps(board)) # Step 3: Write back to Redis
  ```
  If Pilot A and Pilot B submit scores concurrently:
  1. Both read `board` version 0.
  2. Pilot A writes version 1A (including Pilot A's score).
  3. Pilot B writes version 1B (including Pilot B's score, but based on version 0).
  4. Pilot A's update is completely overwritten and lost.
* **Missing Submission Throttles:** The endpoint accepted rapid submissions without delay, allowing bots to spam updates and overload JSON serialization routines.
* **Remediation Principle:**
  * **Concurrency Locking (`asyncio.Lock`):** Serialize read-modify-write operations so that concurrent requests wait their turn, eliminating lost updates.
  * **Submission Throttling:** Enforce a minimum interval (e.g., 5 seconds) between score posts for the same `pilotId`.
  * **Anti-Cheat Delta Clamping:** Clamp maximum XP gains per update (e.g., max +5,000 XP per submission) and cap initial registrations, preventing instant jumps to 10M XP.
  * **HTML Character Neutralization:** Strip dangerous characters (`<`, `>`, `&`, `"`, `'`) from callsigns and titles to prevent stored formatting corruption.
  * **Long-Term Architecture (V2):** Migrate from client-reported scores to a server-authoritative model (`POST /api/quizzes/submit`) where the backend grades answers and increments MMR internally.

---