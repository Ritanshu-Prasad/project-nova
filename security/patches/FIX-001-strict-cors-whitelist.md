# FIX-001: Strict CORS Origin Whitelisting & Header Restriction

[← Back to Patches Index](README.md) | [View Target Vulnerability](../vulnerabilities/VULN-001-cors-csrf-bypass.md)

---

### FIX-001: Strict CORS Origin Whitelisting & Header Restriction

* **Target Vulnerability:** [`VULN-001`](vulnerabilities.md#vuln-001-reflected-origin-cors-with-credentials--csrf-bypass) (Critical — Reflected Origin CORS with Credentials & CSRF Bypass)
* **Component / File:** [`backend/main.py`](backend/main.py) (Lines 23–35)
* **Date Applied:** October 12, 2026
* **Status:** **Applied & Verified**

---

#### 1. Problem Summary
The backend previously passed wildcard `allow_origins=["*"]`, `allow_methods=["*"]`, and `allow_headers=["*"]` to Starlette's `CORSMiddleware` while keeping `allow_credentials=True`. 

Because browsers reject `*` when credentials are included, Starlette dynamically echoed whatever domain was in the `Origin` header into `Access-Control-Allow-Origin` and permitted all headers, enabling arbitrary cross-origin sites to execute authenticated requests with custom headers (`X-Nova: 1`) and read/tamper with victim accounts.

---

#### 2. Remediation Strategy & Steps Taken
1. **Removed Wildcard Origins:** Eliminated `allow_origins=["*"]`.
2. **Environment-Driven Whitelist:** Implemented an origin parser reading from the `ALLOWED_ORIGINS` environment variable, falling back safely to local development hosts (`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3000`, `http://127.0.0.1:3000`).
3. **Explicit Allowed Methods:** Restricted HTTP methods to `["GET", "POST", "PUT", "DELETE", "OPTIONS"]`.
4. **Explicit Allowed Headers:** Restricted request headers to only what the frontend requires: `["Content-Type", "X-Nova", "Authorization"]`.

---

#### 3. Code Diff Applied

```diff
--- a/backend/main.py
+++ b/backend/main.py
@@ -23,8 +23,14 @@
-# Allow requests from our Vite frontend
+# Allow requests from trusted frontend origins only (never wildcard with credentials)
+raw_origins = os.getenv(
+    "ALLOWED_ORIGINS",
+    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
+)
+ALLOWED_ORIGINS = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
+
 app.add_middleware(
     CORSMiddleware,
-    allow_origins=["*"], # In production, restrict this to the frontend URL
+    allow_origins=ALLOWED_ORIGINS,
     allow_credentials=True,
-    allow_methods=["*"],
-    allow_headers=["*"],
+    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
+    allow_headers=["Content-Type", "X-Nova", "Authorization"],
 )
```

---

#### 4. Environment Configuration Guide

To configure permitted origins across environments:

##### Local Development (`backend/.env`):
```bash
ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

##### Production / Staging (e.g., Vercel / Cloud Provider):
Add `ALLOWED_ORIGINS` to project environment variables containing the production domain and any preview staging domains:
```bash
ALLOWED_ORIGINS="https://project-nova.vercel.app,https://nova-staging.vercel.app"
```

---

#### 5. Verification & Testing

##### Test 1: Permitted Origin (Must succeed)
Simulate an approved request from the frontend:
```bash
curl -i -X OPTIONS "http://localhost:8000/api/auth/me" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Nova"
```
**Expected Response:**
* `200 OK`
* `access-control-allow-origin: http://localhost:5173`
* `access-control-allow-credentials: true`

##### Test 2: Unauthorized Origin (Must be rejected)
Simulate an attacker's cross-origin request:
```bash
curl -i -X OPTIONS "http://localhost:8000/api/auth/me" \
  -H "Origin: https://evil-site.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Nova"
```
**Expected Response:**
* The server **does not** return `access-control-allow-origin: https://evil-site.com`.
* The browser blocks the cross-origin request, aborting credential transmission and preventing CSRF bypass.

---