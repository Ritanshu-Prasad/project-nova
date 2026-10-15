# Issue 1: Pilot Authentication, Google OAuth & Progress Sync

**Labels:** `backend`, `auth`, `priority-high`  
**Target Files:** `backend/accounts.py`, `frontend/src/core/account.ts`

---

## 🎯 Goal
Restore and finalize real user accounts via Google OAuth 2.0, secure HTTP-only session cookie management, and multi-device progress synchronization with optimistic concurrency checks.

---

## 📋 Problem Statement
The frontend previously disabled real Google authentication (`GOOGLE_AUTH_ENABLED = false` in `frontend/src/core/account.ts`) and bypassed directly to the pilot profile setup because backend environment secrets (`GOOGLE_CLIENT_ID`, `SESSION_SECRET`, and Upstash Redis) were not yet configured.

Without this backend functionality:
- Pilot XP, MMR, notes, and course progress remain trapped in `localStorage` on a single browser.
- Switching devices or clearing browser cache wipes out all pilot progress.
- There is no unified user account tying together the pilot's profile, avatar, and fleet leaderboard standing.

---

## 🛠️ Required Technical Implementation

### 1. Endpoints to Harden (`backend/accounts.py`)
* `POST /api/auth/google`:
  * Expects `{"accessToken": string}` with `X-Nova: 1` header.
  * Validates token against Google's tokeninfo API (`https://oauth2.googleapis.com/tokeninfo`).
  * Validates audience (`aud` or `azp`) matches `GOOGLE_CLIENT_ID`.
  * Fetches verified user identity from Google Userinfo API.
  * Generates an HMAC-SHA256 signed session cookie (`nova_session`) with `HttpOnly=True`, `SameSite=Lax`, `Secure=True` (in production).
* `GET /api/auth/me`:
  * Verifies cookie signature, validates expiration (`SESSION_DAYS = 30`), and returns `{user: {...}, savedAt: number}`.
* `POST /api/auth/logout`:
  * Clears the `nova_session` cookie.
* `GET /api/progress`:
  * Returns the latest saved pilot state (JSON object containing active course, library, MMR, quiz history).
* `PUT /api/progress`:
  * Expects `{"savedAt": number, "base": number, "save": object}`.
  * If `base` does not match the latest `savedAt` on the server, returns `409 Conflict` (prevents overwriting progress from another device).

### 2. Dual-Storage Support
* **Local Development:** Saves accounts and saves to `backend/.data/accounts.json` via `FileStore`.
* **Production (Vercel / Nebius):** Uses Upstash Redis REST API via `RedisStore` using `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### 3. Frontend Re-activation
Once verified on the backend, update `frontend/src/core/account.ts`:
```typescript
export const GOOGLE_AUTH_ENABLED = true;
```

---

## ✅ Acceptance Criteria
- [ ] Successful Google login sets a secure `nova_session` cookie.
- [ ] Tampered or expired session cookies are rejected with `401 Unauthorized`.
- [ ] Concurrent saves from multiple tabs/devices trigger a 409 conflict instead of silent overwrite.
- [ ] Local mock authentication (`POST /api/auth/dev`) works when `NOVA_DEV_LOGIN=1` for testing without Google keys.
- [ ] Running `python -m py_compile backend/accounts.py` passes with zero errors.
