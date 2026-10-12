# VULN-007: Ephemeral Dev Secret Fallback & Session Drop on Scale

[← Back to Vulnerability Index](README.md) | [View Patch in Patches](../patches/FIX-007-persistent-dev-secret.md)

---

### VULN-007: Ephemeral Dev Secret Fallback & Session Drop on Scale

* **Severity:** **Low / Operational** (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:L - Base Score: 3.7)
* **Category:** Cryptographic Misconfiguration / Insecure State Persistence / Multi-Worker Session Invalidation (CWE-321, CWE-330, CWE-384)
* **Affected Files:**
  * [`backend/accounts.py`](backend/accounts.py) (Lines 126–140)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-007-persistent-local-secret--fail-fast-production-startup-validation))

#### 1. Vulnerability Description & Root Cause
In `backend/accounts.py`, user authentication sessions are maintained via a signed HTTP cookie (`nova_session`) using HMAC-SHA256. 

Prior to remediation, when `SESSION_SECRET` was not provided via environment variables, the backend fell back to a volatile in-memory secret generated at module import:
```python
_dev_secret = secrets.token_urlsafe(32)

def _secret() -> bytes:
    s = os.getenv("SESSION_SECRET")
    if s:
        return s.encode()
    if IS_PRODUCTION:
        raise HTTPException(503, "SESSION_SECRET is not configured (required in production)")
    return _dev_secret.encode()
```

#### 2. Concurrency & Multi-Worker Drop Mechanics (The Scale Defect)
In standard production and development deployments with multi-worker concurrency (e.g., `uvicorn main:app --workers 4` or Gunicorn with multiple process workers):
1. Each Python worker process executes `accounts.py` in its own isolated memory space.
2. Worker 1 initializes `_dev_secret = "Secret_A"`, Worker 2 initializes `_dev_secret = "Secret_B"`, Worker 3 initializes `_dev_secret = "Secret_C"`, and Worker 4 initializes `_dev_secret = "Secret_D"`.
3. When a user authenticates via `/api/auth/google` or `/api/auth/dev`, the response is handled by Worker 1, which signs the cookie using `Secret_A`.
4. On the very next user action (such as loading `/api/progress` or viewing `/api/auth/me`), the operating system or load balancer routes the HTTP request to Worker 2.
5. Worker 2 attempts to verify the signature using `Secret_B`. The HMAC verification `hmac.compare_digest(sig, good)` fails!
6. The backend treats the signature as invalid and rejects the session, immediately logging out the user. Users experience intermittent session drops on every other request.

#### 3. Operational & Security Risks
* **Production Delayed Failure (Lazy Crash):** If a production deployment started without `SESSION_SECRET`, the application booted without any warning. It only crashed with a runtime `503 Service Unavailable` when a user actually attempted an authenticated call.
* **Serverless Cold-Start Session Invalidation:** In serverless or ephemeral container environments (Vercel, AWS Lambda, Cloud Run), container recycling generates a new `_dev_secret` on every cold start, instantly logging out all active users.
* **Development Friction & Hot-Reload Dropout:** Every time a developer saved a file with Uvicorn `--reload`, the server restarted, regenerated `_dev_secret`, and wiped developer login states.
* **Weak Production Secrets:** The system previously permitted weak secrets (e.g. `SESSION_SECRET="secret"`), risking offline HMAC brute-force token forgery.

#### 4. Impact on Project Nova
* Unusable multi-worker and autoscaled deployments due to non-deterministic HMAC signatures.
* Intermittent session termination and degraded user experience.
* High risk of deployment failure during live judge testing or multi-container horizontal scaling.

---