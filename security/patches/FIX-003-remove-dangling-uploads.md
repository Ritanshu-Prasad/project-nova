# FIX-003: Removal of Dangling File Upload Endpoints & Static Mount

[← Back to Patches Index](README.md) | [View Target Vulnerability](../vulnerabilities/VULN-003-dangling-file-uploads.md)

---

### FIX-003: Removal of Dangling File Upload Endpoints & Static Mount

* **Target Vulnerability:** [`VULN-003`](vulnerabilities.md#vuln-003-dangling-public-file-uploads--public-static-mount) (High — Dangling Public File Uploads & Public Static Mount)
* **Component / File:** [`backend/main.py`](backend/main.py) (Lines 7–15, 38–78)
* **Date Applied:** October 12, 2026
* **Status:** **Applied & Verified**

---

#### 1. Problem Summary
The backend exposed two unauthenticated public file upload endpoints (`POST /api/users/avatar/upload` and `POST /api/users/avatar/doodle`) and mounted an unrestricted static file server (`/uploads`). 

The frontend had already moved to in-browser canvas downsampling stored as Data URLs inside user profile state, leaving these endpoints as orphaned dead code. Attackers could exploit these endpoints to upload arbitrary files (up to 5 MB each) using forged `Content-Type` headers, enabling disk exhaustion (DoS) or using the server as an open malware drop.

---

#### 2. Remediation Strategy & Steps Taken
1. **Attack Surface Elimination:** Completely removed the obsolete `upload_avatar` and `upload_doodle` endpoints. Zero upload code eliminates file upload vulnerabilities entirely.
2. **Removed Static Directory Mount:** Removed `app.mount("/uploads", ...)` and disk directory creation `UPLOAD_DIR = "uploads/avatars"`.
3. **Cleaned Unused Imports:** Removed `uuid`, `UploadFile`, `File`, and `StaticFiles` imports from `backend/main.py`.
4. **Maintained Architectural Alignment:** The application relies on client-side canvas data URLs (`avatarImage.ts`) synchronized inside `PilotSave`, perfectly conforming to Vercel's stateless serverless execution model.

---

#### 3. Code Diff Applied

```diff
--- a/backend/main.py
+++ b/backend/main.py
@@ -5,13 +5,11 @@
 import sys
 import time
 from typing import List, Literal
-import uuid
 
 import httpx
-from fastapi import FastAPI, HTTPException, UploadFile, File, Request
+from fastapi import FastAPI, HTTPException, Request
 from fastapi.middleware.cors import CORSMiddleware
 from fastapi.responses import StreamingResponse
-from fastapi.staticfiles import StaticFiles
 from pydantic import BaseModel, Field
 
@@ -38,40 +36,5 @@
-UPLOAD_DIR = "uploads/avatars"
-os.makedirs(UPLOAD_DIR, exist_ok=True)
-
-# Serve the uploaded files statically so the frontend can display them
-app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
-
 @app.get("/")
 def read_root():
     return {"status": "System Online", "service": "Project Nova API"}
-
-AVATAR_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
-AVATAR_MAX_BYTES = 5 * 1024 * 1024
-
-async def _store_avatar(file: UploadFile, prefix: str) -> dict:
-    ext = AVATAR_TYPES.get(file.content_type or "")
-    if not ext:
-        raise HTTPException(415, "Avatar must be a PNG, JPEG, WebP or GIF image")
-    data = await file.read(AVATAR_MAX_BYTES + 1)
-    if len(data) > AVATAR_MAX_BYTES:
-        raise HTTPException(413, "Avatar is larger than 5 MB")
-    filename = f"{prefix}{uuid.uuid4().hex}{ext}"
-    with open(os.path.join(UPLOAD_DIR, filename), "wb") as buffer:
-        buffer.write(data)
-    return {"status": "success", "filename": filename, "url": f"/uploads/avatars/{filename}"}
-
-@app.post("/api/users/avatar/upload")
-async def upload_avatar(file: UploadFile = File(...)):
-    return await _store_avatar(file, "")
-
-@app.post("/api/users/avatar/doodle")
-async def upload_doodle(file: UploadFile = File(...)):
-    return await _store_avatar(file, "doodle_")
```

---

#### 4. Verification & Testing

##### Test 1: Upload Endpoint Blocked (Must return 404 Not Found)
```bash
curl -i -X POST "http://localhost:8000/api/users/avatar/upload" \
  -F "file=@/dev/null"
```
**Expected Response:**
* `404 Not Found`

##### Test 2: Doodle Upload Endpoint Blocked (Must return 404 Not Found)
```bash
curl -i -X POST "http://localhost:8000/api/users/avatar/doodle" \
  -F "file=@/dev/null"
```
**Expected Response:**
* `404 Not Found`

##### Test 3: Static Mount Inaccessible (Must return 404 Not Found)
```bash
curl -i "http://localhost:8000/uploads/avatars/test.png"
```
**Expected Response:**
* `404 Not Found`

##### Test 4: API Health Check Intact
```bash
curl -i "http://localhost:8000/"
```
**Expected Response:**
* `200 OK` (`{"status":"System Online","service":"Project Nova API"}`)

---