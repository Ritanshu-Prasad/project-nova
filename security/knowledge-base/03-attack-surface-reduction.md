# 3. Dangling Public File Uploads & Public Static Mount

[← Back to Knowledge Base Index](README.md) | [View Vulnerability](../vulnerabilities/VULN-003-dangling-file-uploads.md) | [View Patch](../patches/FIX-003-remove-dangling-uploads.md)

---

## 3. Dangling Public File Uploads & Public Static Mount

### High-Level Concept
"Dangling" or orphaned code refers to API endpoints that remain active and exposed on the backend after the frontend has migrated to a different architecture. In this project, avatar uploads were migrated to in-browser canvas downsampling, leaving backend multipart upload endpoints unauthenticated and exposed.

### Key Points & Mechanics
* **Architectural Drift:** The frontend (`avatarImage.ts`) encodes photos as base64 Data URLs and stores them directly in client state (`PilotSave`). The backend endpoints `/api/users/avatar/upload` and `/api/users/avatar/doodle` were never called by legitimate users.
* **Unauthenticated File Drops:** The upload routes lacked session verification and CSRF protection, allowing any anonymous client to upload files up to 5 MB.
* **Client-Supplied MIME Spoofing:** The backend verified file types using:
  ```python
  ext = AVATAR_TYPES.get(file.content_type or "")
  ```
  The `Content-Type` header is set by the client. An attacker could upload arbitrary binary executables, HTML, or SVG scripts simply by specifying `Content-Type: image/png`.
* **Absence of Magic Byte Verification:** The server did not verify file signatures (magic bytes) or decode images through an imaging library (such as Pillow).
* **Static File Mount Risks:** Mounting `/uploads` statically allowed uploaded files to be retrieved directly over HTTP without `X-Content-Type-Options: nosniff`, risking stored XSS or malware hosting.
* **Serverless Incompatibility:** On Vercel, container disks are ephemeral and read-only. File writes either fail or are discarded upon invocation completion.
* **Remediation Principle:**
  * **Attack Surface Reduction:** The most secure code is code that does not exist. Pruning dead endpoints eliminates vulnerabilities entirely without introducing maintenance overhead.

---