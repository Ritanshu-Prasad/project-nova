# VULN-001: Reflected Origin CORS with Credentials & CSRF Bypass

[← Back to Vulnerability Index](README.md) | [View Patch in Patches](../patches/FIX-001-strict-cors-whitelist.md)

---

### VULN-001: Reflected Origin CORS with Credentials & CSRF Bypass

* **Severity:** **Critical** (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N - Base Score: 8.1)
* **Category:** Broken Access Control / Cross-Origin Resource Sharing (CORS) Misconfiguration (CWE-346, CWE-352)
* **Affected Files:**
  * [`backend/main.py`](backend/main.py) (Lines 24–30)
  * [`backend/accounts.py`](backend/accounts.py) (Lines 175–179)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-001-strict-cors-origin-whitelisting--header-restriction))

#### 1. Vulnerability Description & Root Cause
In `backend/main.py`, the application configured FastAPI's `CORSMiddleware` with wildcard origins and allowed credentials:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Under the W3C Fetch specification, browsers strictly disallow credentialed cross-origin requests when the server responds with `Access-Control-Allow-Origin: *`. 

To prevent broken connections when developers configure both `allow_origins=["*"]` and `allow_credentials=True`, Starlette's `CORSMiddleware` dynamically inspects the incoming `Origin` header from the client and **reflects that exact origin** back in the `Access-Control-Allow-Origin` response header, while appending `Access-Control-Allow-Credentials: true`.

#### 2. CSRF Defense Neutralization
In `backend/accounts.py`, the backend implements a custom header check as its sole CSRF defense:
```python
def _require_csrf(request: Request) -> None:
    if request.headers.get("x-nova") != "1":
        raise HTTPException(403, "Missing X-Nova header")
```
The developer assumed cross-site pages cannot attach custom headers (`X-Nova`) without failing a preflight check. However, because `allow_headers=["*"]` and `allow_origins=["*"]` were set, Starlette automatically approved preflight `OPTIONS` requests from **any domain on the internet**, permitting attackers to attach `X-Nova: 1`.

#### 3. Attack Vector & Impact
1. An authenticated pilot who signed in to Project Nova visits a malicious webpage (e.g., `https://evil-site.com`).
2. The malicious page executes JavaScript to send an asynchronous credentialed request to the Project Nova API (`https://api.yourdomain.com/api/progress` or `/api/auth/me`) with `credentials: 'include'` and header `X-Nova: 1`.
3. The victim's browser initiates a CORS preflight (`OPTIONS`) request.
4. Starlette's `CORSMiddleware` returns:
   ```http
   Access-Control-Allow-Origin: https://evil-site.com
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Headers: *
   ```
5. The browser verifies the preflight response and sends the actual request, attaching the user's `nova_session` authentication cookie.
6. The backend validates the cookie and `X-Nova: 1` header, processing the request.
7. **Impact:**
   * **Data Exfiltration:** Attackers can read sensitive user details (Google account ID, email, profile name) via `GET /api/auth/me` and complete learning progress via `GET /api/progress`.
   * **Data Tampering & Destruction:** Attackers can issue `PUT /api/progress` to overwrite or wipe the pilot's progress save.
   * **Unauthorized State Modification:** Attackers can trigger session termination via `POST /api/auth/logout`.

---