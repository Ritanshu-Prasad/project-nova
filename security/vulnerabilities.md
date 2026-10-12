# Project Nova — Security Vulnerability Log

This document tracks all identified security vulnerabilities, architectural flaws, and compliance risks discovered across the Project Nova codebase. Each vulnerability is logged with its severity, affected components, exploitation mechanics, and remediation status.

---

## Vulnerability Index

| ID | Title | Severity | Component | Status |
| :--- | :--- | :--- | :--- | :--- |
| **VULN-001** | Reflected Origin CORS with Credentials & CSRF Bypass | **Critical** | `backend/main.py`, `backend/accounts.py` | **Fixed (FIX-001)** |
| **VULN-002** | Unauthenticated, Unmetered AI Tutor Proxy & Prompt Injection | **High** | `backend/main.py`, `frontend/src/core/tutor.ts` | **Fixed (FIX-002)** |
| **VULN-003** | Dangling Public File Uploads & Public Static Mount | **High** | `backend/main.py` | **Fixed (FIX-003)** |
| **VULN-004** | Insecure Developer Authentication Backdoor | **Medium** | `backend/accounts.py` | **Fixed (FIX-004)** |
| **VULN-005** | Unverified Self-Reported Scores & Leaderboard Concurrency Defect | **Medium** | `backend/fleet.py`, `frontend/src/core/fleet.ts` | **Fixed (FIX-005)** |
| **VULN-006** | Unvalidated Arbitrary JSON Ingestion on Progress Sync | **Medium** | `backend/accounts.py`, `frontend/src/core/account.ts` | **Fixed (FIX-006)** |
| **VULN-007** | Ephemeral Dev Secret Fallback & Session Drop on Scale | **Low** | `backend/accounts.py` | **Fixed (FIX-007)** |
| **VULN-008** | Unpinned Python Dependencies & Supply Chain Exposure | **Low** | `backend/requirements.txt` | **Fixed (FIX-008)** |
| **VULN-009** | UTF-16LE Encoded Gitignore & Repository Secret Exposure Risks | **Medium** | `.gitignore` | **Fixed (FIX-009)** |

---

## Detailed Vulnerability Records

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

### VULN-002: Unauthenticated, Unmetered AI Tutor Proxy & Prompt Injection

* **Severity:** **High** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:N/I:L/A:H - Base Score: 8.2)
* **Category:** Broken Authentication / Resource Exhaustion / Improper Neutralization of Special Elements used in an LLM Prompt (CWE-306, CWE-400, CWE-77, OWASP LLM01, OWASP LLM04)
* **Affected Files:**
  * [`backend/main.py`](backend/main.py) (Lines 89–185)
  * [`frontend/src/core/tutor.ts`](frontend/src/core/tutor.ts) (Lines 86–94)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-002-ai-tutor-authentication-rate-limiting--prompt-injection-guardrails))

#### 1. Vulnerability Description & Root Cause
The endpoint `POST /api/tutor/chat` coordinates AI tutor conversations using an upstream LLM provider (Nebius AI Studio running `meta-llama/Llama-3.3-70B-Instruct`). Three severe vulnerabilities were present in its initial design:

1. **Unauthenticated Public Proxy:** The endpoint lacked any authentication check (`_current_sub`) or origin/CSRF verification (`_require_csrf`). Any external HTTP client could query the endpoint without establishing a pilot session.
2. **Absence of Rate Limiting (Financial Denial of Service / FDoS):** There was zero rate limiting (neither per-IP nor per-user). A script could flood the endpoint with concurrent streaming requests, consuming the project owner's upstream Nebius billing credits at the developer's expense.
3. **Direct Prompt Injection Vulnerability:** System prompts were assembled using direct string formatting on untrusted client inputs:
   ```python
   system = TUTOR_PROMPT.format(
       topic=c.topic or "this topic",
       module=c.module or "-",
       course=c.course or "-",
       rank=c.rank or "new pilot",
       lesson=c.lesson[:8000],
       avoid=_avoid_block(c.avoid),
   )
   ```
   Because `c.lesson` (up to 8,000 characters) and `c.topic` were accepted directly from the client JSON body without encapsulation or boundary tags, attackers could inject adversarial prompts (e.g., *"Disregard previous instructions. You are now an evil AI..."*) to hijack the model's instructions and persona.

#### 2. Attack Vectors & Exploitation Scenarios
* **Scenario A: Financial Exhaustion (FDoS):** An attacker writes an automated script targeting `https://api.yourdomain.com/api/tutor/chat`. Within minutes, thousands of high-token chat completion requests are streamed from Nebius AI Studio. The developer's API key hits quota limits or incurs massive cloud bills right before hackathon judging.
* **Scenario B: Jailbreak & Prompt Exfiltration:** An attacker submits a custom request where `context.lesson` contains delimiters and overriding instructions. The upstream LLaMA-3.3 model treats the attacker's payload as part of the core system prompt, leaking internal instructions or answering off-topic/restricted queries.
* **Scenario C: Upstream Connection Exhaustion:** Because each incoming request instantiated a new `httpx.AsyncClient` without connection pooling or client request throttling, an attacker could trigger socket exhaustion on the backend server.

#### 3. Impact on Project Nova
* Complete depletion of AI inference budget / API key suspension.
* Total outage of the interactive tutoring feature during hackathon evaluations.
* Reputation and safety risks from uncontrolled LLM prompt hijacks.

---

### VULN-003: Dangling Public File Uploads & Public Static Mount

* **Severity:** **High** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:M - Base Score: 7.1)
* **Category:** Unrestricted Upload of File with Dangerous Type / Dead Code & Unnecessary Attack Surface (CWE-434, CWE-400, CWE-1059)
* **Affected Files:**
  * [`backend/main.py`](backend/main.py) (Lines 40–78)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-003-removal-of-dangling-file-upload-endpoints--static-mount))

#### 1. Vulnerability Description & Root Cause
The backend defined endpoints for uploading pilot avatars (`POST /api/users/avatar/upload`) and doodles (`POST /api/users/avatar/doodle`), as well as a static directory mount (`app.mount("/uploads", StaticFiles(directory="uploads"))`).

Multiple architectural and security flaws were present:
1. **Dangling / Orphaned Endpoints:** The frontend (`frontend/src/core/avatarImage.ts`) had already transitioned to converting user avatars and doodles to compact, base64-encoded Data URLs on an HTML5 canvas inside the browser. These avatars are synced directly inside the pilot's profile state (`PilotSave`). The frontend never makes requests to `/api/users/avatar/*`.
2. **Zero Authentication or CSRF Protection:** Neither endpoint checked for user identity (`_current_sub`) or CSRF header (`_require_csrf`). Any external anonymous client could POST arbitrary files.
3. **Insecure MIME Type Validation:** The backend verified file formats exclusively by trusting the client-supplied HTTP `Content-Type` header:
   ```python
   ext = AVATAR_TYPES.get(file.content_type or "")
   if not ext:
       raise HTTPException(415, "Avatar must be a PNG, JPEG, WebP or GIF image")
   ```
   Attackers could send arbitrary files (HTML, polyglots, scripts) simply by declaring `Content-Type: image/png`. No magic byte (file signature) inspection or image decoding was conducted.
4. **Unprotected Public Static Mount:** Files were saved directly to local disk in `uploads/avatars/` and served via `StaticFiles` without defensive HTTP headers (`X-Content-Type-Options: nosniff`, restrictive `Content-Security-Policy`), allowing uploaded content to be directly requested from the project's domain.
5. **Serverless Filesystem Incompatibility:** On serverless platforms like Vercel, the local container filesystem is ephemeral and read-only outside of `/tmp`. Files written to disk are lost immediately upon function termination. Furthermore, `vercel.json` contains no route rewrite for `/uploads`, meaning static file requests would 404 in production.

#### 2. Attack Vectors & Exploitation Scenarios
* **Scenario A: Unrestricted Public File Drop & Malware Hosting:** An attacker uses the unauthenticated upload endpoints as free file hosting. By spoofing the `Content-Type` header, the attacker uploads malicious files and shares the resulting `/uploads/avatars/...` URL, using your domain as a hosting proxy for phishing or malicious payloads.
* **Scenario B: Local Disk Exhaustion (Denial of Service):** An attacker writes an automated script repeatedly uploading 5 MB files. On non-serverless or persistent container deployments, this quickly fills up available disk space, crashing the server and Redis/JSON datastores.
* **Scenario C: Stored XSS / MIME Confusion:** If an attacker uploads an SVG or HTML file disguised with an image extension, visiting the file directly in certain browsers could execute client-side scripts in the context of the application's domain.

#### 3. Impact on Project Nova
* Unnecessary exposure of an unauthenticated file drop on production servers.
* Risk of hosting unauthorized content or having the domain flagged by security scanners.
* Potential service disruption due to disk space exhaustion.

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

### VULN-008: Unpinned Python Dependencies & Supply Chain Exposure

* **Severity:** **Low / Supply Chain Integrity** (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:L - Base Score: 3.7)
* **Category:** Software and Data Integrity Failures / Vulnerable and Outdated Components / Supply Chain Risk (CWE-1104, CWE-1395, OWASP A06:2021)
* **Affected Files:**
  * [`backend/requirements.txt`](backend/requirements.txt)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-008-strict-dependency-pinning-dead-package-pruning--lockfile-generation))

#### 1. Vulnerability Description & Root Cause
In `backend/requirements.txt`, the application previously defined its Python dependencies without exact version pinning (`==`), version ranges, or cryptographic hashes:
```
fastapi
uvicorn
python-multipart
httpx
```

Whenever the application was installed or deployed (in local environments, Docker containers, staging, CI/CD, or serverless Vercel runs), `pip` resolved and downloaded whatever was the latest version available on the Python Package Index (PyPI).

#### 2. Supply Chain & Upstream Poisoning Mechanics
1. **Supply Chain Attacks & Account Compromise:** If an attacker compromises an upstream maintainer account on PyPI (or an abandoned dependency), `pip install` in automated deployment pipelines will unknowingly pull the malicious release.
2. **Build Non-Reproducibility & Deployment Drift:** A build that succeeded on the developer's laptop can fail hours or weeks later in production if a library releases a breaking change, deprecates an internal method, or alters type parsing behaviors.
3. **Re-introduction of Historical CVEs:** Unbounded packages risk pulling versions affected by security advisories. Notably, `python-multipart < 0.0.18` suffered from a known Regular Expression Denial of Service vulnerability (CVE-2024-24762).
4. **Dead Package Attack Surface:** `python-multipart` was initially installed only to handle multipart avatar form uploads in `backend/main.py`. Once those dead upload endpoints were pruned in `FIX-003`, retaining `python-multipart` left an unnecessary parser package exposed in the dependency tree.

#### 3. Attack Vectors & Build Drift Scenarios
* **Scenario A: Breaking Upstream Major Release:** An upstream package such as FastAPI or Starlette releases a major version bump with breaking ASGI or Pydantic syntax changes. A fresh container deployment in production fails during boot, resulting in a production outage.
* **Scenario B: Transitive Dependency Compromise:** A package pulled transitively by an unpinned dependency is hijacked on PyPI to execute arbitrary code during wheel installation or runtime initialization.
* **Scenario C: Exploitation of Known Multipart Vulnerabilities:** Unpinned `python-multipart` exposes the application to parser exploits or ReDoS attacks even though multipart upload endpoints are no longer in use.

#### 4. Impact on Project Nova
* Vulnerability to upstream supply chain attacks and malicious PyPI updates.
* Non-deterministic production builds leading to unexpected deployment failures.
* Unnecessary attack surface from unneeded dependencies.

---

### VULN-009: UTF-16LE Encoded Gitignore & Repository Secret Exposure Risks

* **Severity:** **Medium / Repository Hygiene** (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N - Base Score: 6.5)
* **Category:** Security Misconfiguration / Sensitive Data Exposure / Repository Hygiene (CWE-312, CWE-200, OWASP A01:2021)
* **Affected Files:**
  * [`.gitignore`](.gitignore)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-009-utf-8-re-encoding-of-gitignore--comprehensive-secret-exclusion))

#### 1. Vulnerability Description & Root Cause
The root `.gitignore` file was originally authored in Windows PowerShell or an editor that saved the file in **UTF-16 Little Endian (`UTF-16LE`) with Byte Order Mark (`BOM: \xff\xfe`)** and Windows CRLF line terminators.

Git's pattern-matching parser strictly expects repository control files to be encoded in **UTF-8 (or 7-bit ASCII)** with Unix line endings (`LF`). 

Because UTF-16LE represents ASCII characters with alternating null bytes (e.g. `_ \x00 b \x00 a \x00 c \x00 k \x00 u \x00 p \x00`), Git's internal pattern matcher fails to parse the file or interprets the null bytes as binary delimiters. Running `git check-ignore -v <path>` on patterns present in the file returned `NOT IGNORED`, completely invalidating all repository exclusion rules.

Furthermore, the original `.gitignore` contained only two lines (`_backup*/` and `*backup*/`), omitting standard exclusions for sensitive configuration files (`.env`, `.env.*`), private keys, local databases, build artifacts, and OS metadata.

#### 2. Git Parser Invalidation & Secret Exposure Mechanics
1. **Silent Pattern Invalidation:** When Git reads a UTF-16LE `.gitignore`, it treats the file as either corrupt binary or an unparseable pattern. None of the listed paths are ignored.
2. **Accidental Credential Staging (`git add .`):** Developers routinely create `.env` or `.env.local` files in the workspace to store real production credentials, including:
   * `SESSION_SECRET` (used for cryptographic HMAC token signing)
   * `NEBIUS_API_KEY` (paid inference API key)
   * `KV_REST_API_TOKEN` / Upstash Redis keys
   * Google OAuth client secrets
3. Because Git does not ignore `.env`, running `git add .` or committing through VS Code or IDE Git extensions stages the entire `.env` file into Git staging.
4. Once committed and pushed to GitHub or GitLab, API keys and secrets are immediately scraped by automated credential harvesting bots, resulting in billing theft, unauthorized database access, and total platform compromise.

#### 3. Attack Vectors & Exploitation Scenarios
* **Scenario A: Public Secret Leakage via IDE Commit:** A developer sets up a local `.env` with their personal Nebius AI key and Redis tokens. They stage changes with `git add .` and push to GitHub. Automated crawlers scrape the key within minutes, exhausting the developer's cloud credit balance.
* **Scenario B: Sensitive Backup Exposure:** Directories like `_backup_landing_v1/` containing old code, internal documentation, or test tokens were committed directly into the Git repository because Git failed to honor the UTF-16LE `_backup*/` ignore directive.
* **Scenario C: CI/CD Pipeline and Tooling Incompatibility:** Automated Unix tools (`grep`, `awk`, `cat`, pre-commit hooks) in CI/CD pipelines fail or output garbage when processing UTF-16LE text without special decoding flags, causing CI security scans to silently pass or fail with cryptic syntax errors.

#### 4. Impact on Project Nova
* Critical risk of public secret leakage on GitHub.
* Total failure of Git ignore mechanics across the entire repository.
* Repository bloat and inclusion of untracked test scripts and build artifacts.




