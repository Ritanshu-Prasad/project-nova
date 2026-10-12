# VULN-004: Insecure Developer Authentication Backdoor

[← Back to Vulnerability Index](README.md) | [View Patch in Patches](../patches/FIX-004-dev-login-gating.md)

---

### VULN-004: Insecure Developer Authentication Backdoor

* **Severity:** **Medium** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N - Base Score: 6.5)
* **Category:** Use of Hard-coded or Debug Credentials / Insecure Direct Object References / Authentication Bypass (CWE-489, CWE-306, CWE-287)
* **Affected Files:**
  * [`backend/accounts.py`](backend/accounts.py) (Lines 263–276)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-004-multi-layered-environment-gating--input-validation-for-dev-login))

#### 1. Vulnerability Description & Root Cause
During rapid development and prototyping, developers created `POST /api/auth/dev` in `backend/accounts.py` to test account creation and progress persistence without needing a configured Google OAuth Client ID:
```python
@router.post("/api/auth/dev")
async def auth_dev(request: Request, response: Response):
    """Local testing only — a fake account without Google."""
    if os.getenv("NOVA_DEV_LOGIN") != "1" or ON_VERCEL:
        raise HTTPException(404, "Not found")
    _require_csrf(request)
    body = await request.json()
    email = str(body.get("email") or "pilot@example.com")
    sub = f"dev:{email}"
    _, is_new = await _upsert_user(sub, email, str(body.get("name") or "Test Pilot"), "")
    _set_session(response, request, sub)
    reply = await _account_reply(sub)
    return {**reply, "isNew": is_new}
```

The endpoint was protected only by checking `if os.getenv("NOVA_DEV_LOGIN") != "1" or ON_VERCEL`. This introduced several critical vulnerabilities:
1. **Hosting Provider Lock-in Flaw:** The check relied exclusively on `ON_VERCEL = bool(os.getenv("VERCEL"))`. If the application is deployed on Docker, AWS EC2, AWS ECS, Google Cloud Run, Render, Railway, or Fly.io, `VERCEL` is not defined (`ON_VERCEL == False`). If `NOVA_DEV_LOGIN=1` was left enabled in an environment file or deployment manifest, the debug login backdoor became active in production.
2. **Arbitrary Account Takeover & Impersonation:** The endpoint required no passwords, no tokens, and no proof of ownership. Any caller could pass `{"email": "target@example.com"}` to receive a signed `nova_session` cookie for that account, gaining full read and write access to the pilot's profile and saved courses.
3. **Unvalidated Input & Key Injection Risk:** The `email` field was accepted without formatting or length validation. An attacker could pass extremely long strings or malicious characters into `sub = f"dev:{email}"`, causing Redis key pollution (`nova:user:dev:...`).
4. **Ephemeral Secret Fallback:** In non-Vercel environments without `SESSION_SECRET`, the backend silently generated an in-memory secret that rotated on server restart, leading to session desync across multiple uvicorn worker processes.

#### 2. Attack Vectors & Exploitation Scenarios
* **Scenario A: Unauthorized Impersonation on Cloud Hosting:** An attacker discovers `POST /api/auth/dev` on a staging or production instance deployed on Docker/Render. By passing `{"email": "admin@example.com"}`, the attacker instantly logs in as that user without providing any credentials or Google tokens.
* **Scenario B: Data Tampering & Progress Destruction:** Using the minted dev session cookie, the attacker issues `PUT /api/progress` to overwrite the victim's saved progress with corrupted data.

#### 3. Impact on Project Nova
* Total authentication bypass allowing unauthenticated users to impersonate accounts.
* High risk of exposure on containerized or non-Vercel production deployments.

---