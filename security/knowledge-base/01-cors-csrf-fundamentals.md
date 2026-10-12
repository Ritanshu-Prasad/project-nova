# 1. Reflected Origin CORS with Credentials & CSRF Bypass

[← Back to Knowledge Base Index](README.md) | [View Vulnerability](../vulnerabilities/VULN-001-cors-csrf-bypass.md) | [View Patch](../patches/FIX-001-strict-cors-whitelist.md)

---

## 1. Reflected Origin CORS with Credentials & CSRF Bypass

### High-Level Concept
Cross-Origin Resource Sharing (CORS) is a browser mechanism that restricts how scripts from one origin can interact with resources on another origin. When a site allows credentials (such as cookies), browsers enforce strict rules. A misconfiguration where the server dynamically reflects the caller's origin turns CORS into a major security hole, allowing any third-party website to impersonate users and bypass CSRF protections.

### Key Points & Mechanics
* **The Browser Rule:** Under the W3C Fetch specification, a server responding to a credentialed cross-origin request (`credentials: 'include'`) **cannot** return `Access-Control-Allow-Origin: *`.
* **Framework Pitfall (Starlette / FastAPI):** When configured with `allow_origins=["*"]` and `allow_credentials=True`, Starlette does not send `*`. Instead, it automatically reads the incoming `Origin` header from the request and echoes it back in the response header (`Access-Control-Allow-Origin: <origin>`).
* **The False Sense of Security:** Many developers rely on custom headers (e.g., `X-Nova: 1`) as an anti-CSRF token, believing cross-site requests cannot send custom headers.
* **The Flaw:** Because `allow_headers=["*"]` was enabled, the browser's preflight `OPTIONS` request is approved for *any origin*, granting the malicious page permission to attach `X-Nova: 1`.
* **The Exploit Flow:**
  1. User logs into Project Nova. Browser holds HttpOnly cookie `nova_session`.
  2. User browses to an unrelated malicious website `evil.com`.
  3. `evil.com` sends a JavaScript request to `https://api.projectnova.com/api/progress` with `{ credentials: 'include', headers: { 'X-Nova': '1' } }`.
  4. Server reflects `evil.com` as an allowed origin.
  5. The victim's browser includes the `nova_session` cookie and passes the response to `evil.com`'s script.
* **Remediation Principle:**
  * Never use wildcards (`*`) when credentials are enabled.
  * Whitelist exact, trusted origin domains via environment variables (`ALLOWED_ORIGINS`).
  * Explicitly enumerate permitted HTTP methods and headers.

---