# VULN-006: Unvalidated Arbitrary JSON Ingestion on Progress Sync

[← Back to Vulnerability Index](README.md) | [View Patch in Patches](../patches/FIX-006-pydantic-schema-validation.md)

---

### VULN-006: Unvalidated Arbitrary JSON Ingestion on Progress Sync

* **Severity:** **Medium** (CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:N/I:H/A:H - Base Score: 6.8)
* **Category:** Improper Input Validation / Stored Denial of Service / Deserialization of Untrusted Data (CWE-20, CWE-502, CWE-400)
* **Affected Files:**
  * [`backend/accounts.py`](backend/accounts.py) (Lines 308–328)
  * [`frontend/src/core/account.ts`](frontend/src/core/account.ts) (Lines 280–301)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-006-pydantic-schema-validation--bound-enforcement-for-progress-sync))

#### 1. Vulnerability Description & Root Cause
Project Nova provides seamless cross-device synchronization for authenticated pilots via the `PUT /api/progress` endpoint. 

In `backend/accounts.py`, the endpoint handler previously bypassed FastAPI's declarative Pydantic validation framework and accepted arbitrary JSON payloads up to 4 MB (`MAX_SAVE_BYTES = 4_000_000`):
```python
raw = await request.body()
body = json.loads(raw)
saved_at = body.get("savedAt") if isinstance(body, dict) else None
save = body.get("save") if isinstance(body, dict) else None
if not isinstance(saved_at, (int, float)) or not isinstance(save, dict):
    raise HTTPException(400, "Expected {savedAt: number, save: object}")
await _store().set(_save_key(sub), json.dumps({"savedAt": saved_at, "save": save}))
```

Beyond verifying that `save` was a Python dictionary, the server enforced **zero schema checks, zero type assertions, zero field length constraints, and zero sanitization** on the nested contents.

#### 2. Cross-Device Client Crash & Stored DoS Mechanics
When a pilot logs in on a new browser or refreshes the page, `reconcile()` fetches the save from `/api/progress` and executes `applySave(save)` in `frontend/src/core/account.ts`:
```typescript
function applySave(save: PilotSave) {
  const library = Object.fromEntries(
    Object.entries(save.course?.library ?? {}).map(([id, e]) => [id, { ...e, course: rebuild(e.course as SlimCourse) }])
  );
  useCourse.setState({ activeId: save.course?.activeId ?? null, library, stats: save.course?.stats ?? freshStats() });
  useHubQuiz.setState({ quizzes: save.hub?.quizzes ?? [], nextAt: save.hub?.nextAt ?? {}, run: null });
  useProfile.getState().setCallsign(save.profile?.callsign ?? '');
  useProfile.getState().setAvatar(save.profile?.avatar ?? '');
  useNova.getState().setThemeColor(save.profile?.themeColor || DEFAULT_COLOR);
  ...
}
```

If an attacker or corrupted client uploads a payload where:
1. `save.course.library` is an array or primitive instead of a dictionary,
2. `save.hub.quizzes` contains non-array types or invalid quiz structures,
3. `save.course.stats` or `save.profile` is corrupted,

`applySave()` throws an unhandled JavaScript `TypeError` (e.g. `TypeError: Object.entries called on non-object` or `save.hub.quizzes.map is not a function`). Because `applySave()` runs synchronously on page load during session initialization, **the entire frontend React application crashes with a white screen**, locking the pilot out of their account permanently across all browsers and devices.

#### 3. Attack Vectors & Exploitation Scenarios
* **Attack Vector 1: Permanent Stored Client DoS:** An attacker who compromises or shares an account issues a single `PUT /api/progress` with `{"savedAt": 123, "save": {"course": "corrupted"}}`. The user's progress is poisoned. Any future attempt by the legitimate user to sign in or sync from any browser results in immediate UI crash.
* **Attack Vector 2: Memory & Storage Bloat:** An attacker sends 4 MB of nested dummy keys or 50,000 artificial course IDs into `save.course.library`. Upstash Redis memory fills with junk data, and every client sync payload inflates to multi-megabyte transfers, consuming mobile bandwidth and stalling UI hydration.
* **Attack Vector 3: Prototype Pollution Keys:** An attacker submits objects containing `__proto__` or `constructor` properties, attempting to poison prototype chains during deep merges in client state stores.
* **Attack Vector 4: Unsanitized Profile XSS & UI Defacement:** Malicious strings in `profile.callsign` containing raw HTML tags (`<script>`, `<img>`, `<iframe>`) or malicious data URIs in `profile.avatar` are persisted directly into the user's synced profile state.

#### 4. Impact on Project Nova
* High risk of permanent client account lockouts via stored Denial of Service.
* High latency and Redis storage degradation due to unconstrained JSON nesting.
* Tampering with learning metrics, MMR progression, and streak counters.

---