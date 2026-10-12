# FIX-004: Multi-Layered Environment Gating & Input Validation for Dev Login

[← Back to Patches Index](README.md) | [View Target Vulnerability](../vulnerabilities/VULN-004-dev-auth-backdoor.md)

---

### FIX-004: Multi-Layered Environment Gating & Input Validation for Dev Login

* **Target Vulnerability:** [`VULN-004`](vulnerabilities.md#vuln-004-insecure-developer-authentication-backdoor) (Medium — Insecure Developer Authentication Backdoor)
* **Component / File:** [`backend/accounts.py`](backend/accounts.py) (Lines 22–36, 130–136, 170–176, 268–285)
* **Date Applied:** October 12, 2026
* **Status:** **Applied & Verified**

---

#### 1. Problem Summary
The development mock authentication route (`POST /api/auth/dev`) allowed logging into any account without credentials or tokens. It was guarded only by checking `if os.getenv("NOVA_DEV_LOGIN") != "1" or ON_VERCEL: raise HTTPException(404)`. On hosting environments other than Vercel (e.g., Docker, AWS ECS, Render, Railway), `ON_VERCEL` is `False`, allowing the backdoor to remain accessible in production if `NOVA_DEV_LOGIN=1` was configured. Additionally, the email input lacked syntax validation and length limits, creating Redis key injection and account hijacking risks.

---

#### 2. Remediation Strategy & Steps Taken
1. **Multi-Factor Environment Gating:** Defined `IS_PRODUCTION = (ENVIRONMENT == "production") or ON_VERCEL`. The endpoint is strictly disabled if `IS_PRODUCTION` is True, even if `NOVA_DEV_LOGIN=1` is passed.
2. **Strict Email Regex Validation:** Enforced `DEV_EMAIL_REGEX` (`^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$`) and capped length at 100 characters to prevent key injection into Redis (`nova:user:dev:...`).
3. **Pilot Name Sanitization:** Stripped non-printable ASCII and control characters (`<`, `>`, `\x00-\x1f`) from the name and capped it at 50 characters.
4. **Production Secret Enforcement:** Updated `_secret()` to fail fast with HTTP `503` if `SESSION_SECRET` is missing in *any* production deployment (not just Vercel), eliminating reliance on volatile in-memory dev secrets in production clusters.
5. **Secure Cookie Enforcement:** Enforced `secure=True` cookie attribute whenever `IS_PRODUCTION` is True.

---

#### 3. Code Diff Applied

```diff
--- a/backend/accounts.py
+++ b/backend/accounts.py
@@ -22,6 +22,7 @@
 import hmac
 import json
 import os
+import re
 import secrets
 import time
 from pathlib import Path
@@ -31,6 +31,10 @@
 router = APIRouter()
 
 ON_VERCEL = bool(os.getenv("VERCEL"))
+ENVIRONMENT = os.getenv("ENVIRONMENT", os.getenv("ENV", "development" if not ON_VERCEL else "production")).lower()
+IS_PRODUCTION = ENVIRONMENT == "production" or ON_VERCEL
+DEV_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
+
 COOKIE = "nova_session"
 SESSION_DAYS = 30
@@ -130,8 +134,8 @@
     s = os.getenv("SESSION_SECRET")
     if s:
         return s.encode()
-    if ON_VERCEL:
-        raise HTTPException(503, "SESSION_SECRET is not configured")
+    if IS_PRODUCTION:
+        raise HTTPException(503, "SESSION_SECRET is not configured (required in production)")
     return _dev_secret.encode()  # local only: sessions end when the server restarts
@@ -171,7 +175,7 @@
         _sign(sub),
         max_age=SESSION_DAYS * 86400,
         httponly=True,
-        secure=request.url.scheme == "https" or ON_VERCEL,
+        secure=request.url.scheme == "https" or IS_PRODUCTION,
         samesite="lax",
         path="/",
     )
@@ -267,14 +271,20 @@
 @router.post("/api/auth/dev")
 async def auth_dev(request: Request, response: Response):
-    """Local testing only — a fake account without Google."""
-    if os.getenv("NOVA_DEV_LOGIN") != "1" or ON_VERCEL:
+    """Local development only — mock authentication strictly gated against production."""
+    if IS_PRODUCTION or os.getenv("NOVA_DEV_LOGIN") != "1":
         raise HTTPException(404, "Not found")
     _require_csrf(request)
     body = await request.json()
-    email = str(body.get("email") or "pilot@example.com")
+    if not isinstance(body, dict):
+        raise HTTPException(400, "Invalid JSON body")
     email = str(body.get("email") or "pilot@example.com").strip().lower()
     if not DEV_EMAIL_REGEX.match(email) or len(email) > 100:
         raise HTTPException(400, "Invalid email format (max 100 characters)")
     raw_name = str(body.get("name") or "Test Pilot").strip()
     name = re.sub(r"[\x00-\x1f\x7f<>]", "", raw_name)[:50] or "Test Pilot"
     sub = f"dev:{email}"
-    _, is_new = await _upsert_user(sub, email, str(body.get("name") or "Test Pilot"), "")
+    _, is_new = await _upsert_user(sub, email, name, "")
     _set_session(response, request, sub)
     reply = await _account_reply(sub)
     return {**reply, "isNew": is_new}
```

---

#### 4. Verification & Testing

##### Test 1: Production Gating (Must return 404 Not Found)
When `ENVIRONMENT=production` or `VERCEL=1`:
```bash
curl -i -X POST "http://localhost:8000/api/auth/dev" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -d '{"email":"test@example.com","name":"Test Pilot"}'
```
**Expected Response:**
* `404 Not Found`

##### Test 2: Invalid Email Format in Development (Must return 400 Bad Request)
When running in dev with `NOVA_DEV_LOGIN=1` and sending an invalid email:
```bash
curl -i -X POST "http://localhost:8000/api/auth/dev" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -d '{"email":"invalid-email-string"}'
```
**Expected Response:**
* `400 Bad Request` (`{"detail":"Invalid email format (max 100 characters)"}`)

##### Test 3: Valid Dev Login in Development
When running in dev with `NOVA_DEV_LOGIN=1` and sending a valid email:
```bash
curl -i -X POST "http://localhost:8000/api/auth/dev" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -d '{"email":"pilot@example.com","name":"Alpha Pilot"}'
```
**Expected Response:**
* `200 OK`
* Sets `Set-Cookie: nova_session=...; HttpOnly; SameSite=lax`

---