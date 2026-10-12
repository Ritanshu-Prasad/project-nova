# 7. Ephemeral Dev Secret Fallback & Session Drop on Scale

[← Back to Knowledge Base Index](README.md) | [View Vulnerability](../vulnerabilities/VULN-007-ephemeral-dev-secret.md) | [View Patch](../patches/FIX-007-persistent-dev-secret.md)

---

## 7. Ephemeral Dev Secret Fallback & Session Drop on Scale

### High-Level Concept
Stateless authentication mechanisms using cryptographically signed cookies (HMAC-SHA256) rely on a shared secret key known to the server. If this secret is generated in volatile memory at process startup instead of being statically loaded from environment configuration or persisted deterministically, scaling horizontally across multiple processes, worker threads, or serverless containers causes intermittent authentication failures.

### Key Points & Mechanics
* **In-Memory Secret Trap:** The backend used `_dev_secret = secrets.token_urlsafe(32)` as a fallback when `SESSION_SECRET` was omitted from the environment.
* **The Multi-Worker Concurrency Trap:**
  * In modern production architectures (such as `uvicorn main:app --workers 4`, Gunicorn, or Kubernetes pods), each Python process runs in its own memory space.
  * Each process independently imports `accounts.py` and creates a different, unique `_dev_secret`.
  * When a user logs in, Worker 1 signs their cookie with `Secret_A`.
  * When the user navigates to the next page, the load balancer directs the request to Worker 2.
  * Worker 2 attempts HMAC verification against `Secret_B`. The comparison fails, and the user is unexpectedly logged out.
* **Delayed Runtime Crashes in Production:**
  * Previously, missing `SESSION_SECRET` in production only threw an `HTTPException(503)` when an authenticated route was executed, rather than failing fast at application boot.
  * Misconfigured production deployments could appear "healthy" in health checks, failing only when end users attempted to log in.
* **Cold-Start Invalidation in Serverless Runtimes:**
  * In ephemeral environments (Vercel, AWS Lambda, Cloud Run), each container cold start generates a fresh in-memory secret, invalidating all pre-existing sessions for users currently using the app.
* **Local Development Hot-Reload Fatigue:**
  * On every file change with `--reload`, Uvicorn restarts, invalidating the developer's session and forcing constant re-logins.
* **Remediation Principle:**
  * **Deterministic Dev Secret Persistence:** In development, persist the generated secret to disk in `.data/dev_session_secret.txt` (chmod 0600, gitignored). All worker processes read the exact same secret, ensuring session continuity.
  * **Fail-Fast Production Assertion:** On application startup, verify `SESSION_SECRET` in production. If missing, too short (< 32 characters), or using an insecure default, abort boot immediately with a clear `RuntimeError`.
  * **Cryptographic Strength Enforcement:** Enforce minimum key entropy so production HMAC signatures cannot be brute-forced.

---