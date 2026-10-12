# VULN-003: Dangling Public File Uploads & Public Static Mount

[← Back to Vulnerability Index](README.md) | [View Patch in Patches](../patches/FIX-003-remove-dangling-uploads.md)

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