# Issue 5: Persistent Profile Picture (PFP) & Doodle Cloud Storage

**Labels:** `backend`, `storage`, `pfp`, `priority-medium`  
**Target Files:** `backend/main.py`

---

## 🎯 Goal
Upgrade avatar file upload (`POST /api/users/avatar/upload`) and custom doodle upload (`POST /api/users/avatar/doodle`) from ephemeral local disk writes to persistent cloud storage or user profile Redis embeddings.

---

## 📋 Problem Statement
Currently, `_store_avatar` in `backend/main.py` saves uploaded PNG/JPEG images and drawn doodles to the local directory `uploads/avatars/`. 

On modern serverless deployment platforms (such as Vercel Serverless Functions or Nebius Serverless Endpoints):
- The local container file system is ephemeral. Any uploaded image file is wiped as soon as the execution container spins down!
- Users who upload a custom avatar or spend time drawing a doodle will find their avatar broken or displaying a 404 image link on their next session.

---

## 🛠️ Required Technical Implementation

### 1. Storage Strategy Options
Implement one of the following two persistent architectures:

#### Option A: Redis Profile Embedding (Zero External Infrastructure — Recommended for Hackathon)
* Since Upstash Redis is already integrated for accounts and saves:
  * When an avatar or doodle is uploaded, resize/compress it to an optimized WebP or JPEG thumbnail (max 256x256 px).
  * Convert the compressed binary to a clean Base64 data URI (`data:image/webp;base64,...`).
  * Return `{ "status": "success", "url": data_uri }`.
  * The frontend already accepts data URIs in `<img src={...} />` and stores it directly inside the pilot's profile!
  * **Result:** Avatars are 100% persistent across sessions and devices without needing AWS S3 or bucket management.

#### Option B: S3 / Nebius Object Storage
* If external cloud storage is preferred:
  * Use `boto3` or `httpx` to upload image binaries to Nebius Object Storage or Cloudflare R2 / AWS S3.
  * Return the public CDN URL.

### 2. File Validation & Security
* Enforce maximum file size: 5 MB.
* Validate magic bytes / MIME types: only allow `image/png`, `image/jpeg`, `image/webp`.
* Sanitize filenames using random UUIDs (`uuid.uuid4().hex`) to prevent path traversal attacks.

---

## ✅ Acceptance Criteria
- [ ] Uploading a JPEG/PNG image returns a permanent URL or data URI that persists across container restarts.
- [ ] Freehand drawn doodles from the frontend `DoodlePad.tsx` save and display properly in the pilot HUD.
- [ ] Malformed or oversized files (>5 MB) are rejected with `413 Payload Too Large` or `415 Unsupported Media Type`.
- [ ] Running `python -m py_compile backend/main.py` passes with zero errors.
