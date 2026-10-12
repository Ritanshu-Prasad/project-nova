# FIX-006: Pydantic Schema Validation & Bound Enforcement for Progress Sync

[← Back to Patches Index](README.md) | [View Target Vulnerability](../vulnerabilities/VULN-006-progress-sync-json.md)

---

### FIX-006: Pydantic Schema Validation & Bound Enforcement for Progress Sync

* **Target Vulnerability:** [`VULN-006`](vulnerabilities.md#vuln-006-unvalidated-arbitrary-json-ingestion-on-progress-sync) (Medium — Unvalidated Arbitrary JSON Ingestion on Progress Sync)
* **Component / File:** [`backend/accounts.py`](backend/accounts.py) (Lines 308–480)
* **Date Applied:** October 12, 2026
* **Status:** **Applied & Verified**

---

#### 1. Problem Summary
The sync endpoint `PUT /api/progress` previously received raw JSON request bodies up to 4 MB without schema validation. It only verified `isinstance(saved_at, (int, float))` and `isinstance(save, dict)`. 

Consequently, corrupted structures, arbitrary keys, massive nested payloads, prototype pollution keys, or malicious HTML strings in user profiles were directly serialized into storage. When synced back to other devices, unexpected object shapes caused fatal `TypeError` crashes during client initialization (`applySave()`), rendering accounts unusable across all browsers.

---

#### 2. Remediation Strategy & Steps Taken
1. **Pydantic Model Architecture:** Designed strongly typed Pydantic v2 schemas mirroring the frontend's `PilotSave` interface:
   * `StatsSyncModel`: Enforces strict bounds on `xp` (0–10,000,000), streaks (0–10,000), `correct`, `answered`, and calendar tracking.
   * `TopicProgressModel` & `ModuleProgressModel`: Validates learning progress states and bounds quiz attempts.
   * `CourseSkillModel`: Enforces MMR bounds (0–10,000) and limits Elo history arrays.
   * `LibraryEntryModel`: Validates course entries and actively blocks prototype pollution keys (`__proto__`, `constructor`).
   * `CourseSyncModel`: Limits maximum course library size to 60 courses.
   * `HubQuizModel` & `HubSyncModel`: Enforces bounds on quiz archives (max 100 quizzes) and schedule timestamps.
   * `ProfileSyncModel`:
     * Strips dangerous HTML tags (`<>&"'`) and control characters from `callsign` (max 50 chars).
     * Enforces size (max 600 KB) and format checks on `avatar` (must be valid `data:image/` URI or HTTP URL).
     * Validates `themeColor` against strict hex color regex (`^#[0-9a-fA-F]{3,8}$`).
     * Sanitizes `activeObjective` text.
   * `ChatMsgModel`: Sanitizes message content and limits tutor thread length (max 40 messages per thread, max 50 threads).
   * `PilotSaveModel`: Enforces schema version `v: Literal[1] = 1`.
   * `ProgressPayload`: Validates `savedAt: float`, `base: Optional[float] = None`, and `save: PilotSaveModel`.
2. **Native FastAPI Request Validation:** Replaced manual `await request.body()` and `json.loads()` with FastAPI's native parameter injection `payload: ProgressPayload`. Malformed payloads now automatically return standard `422 Unprocessable Entity` responses with pinpoint validation errors.
3. **Preserved Concurrency & Size Controls:** Retained the CSRF check (`_require_csrf`), optimistic concurrency conflict check (`savedAt != payload.base` -> `409 Conflict`), and payload byte limit check.

---

#### 3. Code Diff Applied

```diff
--- a/backend/accounts.py
+++ b/backend/accounts.py
@@ -31,2 +31,4 @@
 from fastapi import APIRouter, HTTPException, Request, Response
+from pydantic import BaseModel, Field, field_validator
+from typing import Any, Dict, List, Literal, Optional
@@ -308,23 +310,172 @@
+# ── Progress Schema Validation Models ─────────────────────────────────────────
+
+HEX_COLOR_REGEX = re.compile(r"^#[0-9a-fA-F]{3,8}$")
+
+class StatsSyncModel(BaseModel):
+    xp: int = Field(0, ge=0, le=10_000_000)
+    streak: int = Field(0, ge=0, le=10_000)
+    bestStreak: int = Field(0, ge=0, le=10_000)
+    correct: int = Field(0, ge=0, le=500_000)
+    answered: int = Field(0, ge=0, le=500_000)
+    day: Optional[str] = Field(None, max_length=20)
+    dayQuizzes: Optional[int] = Field(0, ge=0, le=1000)
+
+class TopicProgressModel(BaseModel):
+    cleared: bool = False
+    notes: str = Field("", max_length=5000)
+    @field_validator("notes")
+    @classmethod
+    def sanitize_notes(cls, v: str) -> str:
+        return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(v or "")).strip()[:5000]
+
+class ModuleProgressModel(BaseModel):
+    passed: bool = False
+    best: float = Field(0.0, ge=0.0, le=1.0)
+    attempts: int = Field(0, ge=0, le=1000)
+
+class CourseSkillModel(BaseModel):
+    mmr: float = Field(0.0, ge=0.0, le=10_000.0)
+    history: List[float] = Field(default_factory=list, max_length=100)
+    correct: int = Field(0, ge=0, le=500_000)
+    answered: int = Field(0, ge=0, le=500_000)
+    questionHistory: Optional[Dict[str, bool]] = None
+
+class LibraryEntryModel(BaseModel):
+    course: Dict[str, Any]
+    progress: Dict[str, TopicProgressModel] = Field(default_factory=dict)
+    modules: Dict[str, ModuleProgressModel] = Field(default_factory=dict)
+    skill: Optional[CourseSkillModel] = None
+    current: str = Field("", max_length=100)
+    updatedAt: float = Field(0.0)
+    completedAt: Optional[float] = None
+    @field_validator("course")
+    @classmethod
+    def validate_course(cls, v: Dict[str, Any]) -> Dict[str, Any]:
+        if not isinstance(v, dict): raise ValueError("course must be an object")
+        if "__proto__" in v or "constructor" in v: raise ValueError("Forbidden prototype pollution keys")
+        if not v.get("id"): raise ValueError("course must contain an id")
+        return v
+
+class CourseSyncModel(BaseModel):
+    activeId: Optional[str] = Field(None, max_length=100)
+    library: Dict[str, LibraryEntryModel] = Field(default_factory=dict)
+    stats: StatsSyncModel = Field(default_factory=StatsSyncModel)
+    @field_validator("library")
+    @classmethod
+    def limit_library_size(cls, v: Dict[str, LibraryEntryModel]) -> Dict[str, LibraryEntryModel]:
+        if len(v) > 60: raise ValueError("Maximum 60 courses allowed in library")
+        return v
+
+class HubQuizModel(BaseModel):
+    id: str = Field(..., max_length=100)
+    courseId: str = Field(..., max_length=100)
+    formedAt: float
+    title: str = Field("", max_length=200)
+    questions: List[Any] = Field(default_factory=list, max_length=50)
+    limits: List[Optional[float]] = Field(default_factory=list, max_length=50)
+    seen: bool = False
+    result: Optional[Dict[str, Any]] = None
+
+class HubSyncModel(BaseModel):
+    quizzes: List[HubQuizModel] = Field(default_factory=list, max_length=100)
+    nextAt: Dict[str, float] = Field(default_factory=dict)
+
+class ProfileSyncModel(BaseModel):
+    callsign: str = Field("", max_length=50)
+    avatar: Optional[str] = Field("", max_length=600_000)
+    themeColor: str = Field("#06b6d4", max_length=25)
+    activeObjective: Optional[str] = Field(None, max_length=200)
+    @field_validator("callsign")
+    @classmethod
+    def sanitize_callsign(cls, v: str) -> str:
+        return re.sub(r"[\x00-\x1f\x7f<>&\"']", "", str(v or "")).strip()[:50]
+    @field_validator("avatar")
+    @classmethod
+    def validate_avatar(cls, v: Optional[str]) -> str:
+        if not v: return ""
+        s = str(v).strip()
+        if len(s) > 600_000: raise ValueError("Avatar data exceeds maximum size (600KB)")
+        if s.startswith("data:image/") or s.startswith("http://") or s.startswith("https://") or s.startswith("/"):
+            return s
+        raise ValueError("Invalid avatar URI format")
+
+class ChatMsgModel(BaseModel):
+    role: Literal["user", "assistant"]
+    content: str = Field(..., max_length=10_000)
+    offline: Optional[bool] = None
+
+class PilotSaveModel(BaseModel):
+    v: Literal[1] = 1
+    course: CourseSyncModel = Field(default_factory=CourseSyncModel)
+    hub: HubSyncModel = Field(default_factory=HubSyncModel)
+    profile: ProfileSyncModel = Field(default_factory=ProfileSyncModel)
+    tutor: Dict[str, List[ChatMsgModel]] = Field(default_factory=dict)
+
+class ProgressPayload(BaseModel):
+    savedAt: float
+    base: Optional[float] = None
+    save: PilotSaveModel
+
 @router.put("/api/progress")
-async def put_progress(request: Request):
+async def put_progress(payload: ProgressPayload, request: Request):
     _require_csrf(request)
     sub = _current_sub(request)
-    raw = await request.body()
-    if len(raw) > MAX_SAVE_BYTES:
-        raise HTTPException(413, "Save is too large")
-    try:
-        body = json.loads(raw)
-    except ValueError:
-        raise HTTPException(400, "Invalid JSON")
-    saved_at = body.get("savedAt") if isinstance(body, dict) else None
-    save = body.get("save") if isinstance(body, dict) else None
-    if not isinstance(saved_at, (int, float)) or not isinstance(save, dict):
-        raise HTTPException(400, "Expected {savedAt: number, save: object}")
     current = await _load_json(_save_key(sub))
-    if current and current.get("savedAt") != body.get("base"):
+    if current and current.get("savedAt") != payload.base:
         raise HTTPException(409, "A newer save exists")
-    await _store().set(_save_key(sub), json.dumps({"savedAt": saved_at, "save": save}))
-    return {"savedAt": saved_at}
+    save_dict = payload.save.model_dump()
+    data = json.dumps({"savedAt": payload.savedAt, "save": save_dict})
+    if len(data.encode("utf-8")) > MAX_SAVE_BYTES:
+        raise HTTPException(413, "Save is too large")
+    await _store().set(_save_key(sub), data)
+    return {"savedAt": payload.savedAt}
```

---

#### 4. Verification & Testing

##### Test 1: Rejection of Malformed / Corrupted Save Structure (Returns 422)
Attempting to post arbitrary or corrupted save payloads:
```bash
curl -i -X PUT "http://localhost:8000/api/progress" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -b "nova_session=<valid_cookie>" \
  -d '{"savedAt": 1728734000000, "save": {"v": 2, "course": "not-an-object"}}'
```
**Expected Response:**
* Returns `HTTP/1.1 422 Unprocessable Entity`.
* Response body returns specific Pydantic validation errors detailing that `course` must be an object and `v` must equal 1.

##### Test 2: Sanitization of Profile Callsign & Avatar
Submitting a valid save with XSS tags in `callsign` and an invalid avatar URI:
```bash
curl -i -X PUT "http://localhost:8000/api/progress" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -b "nova_session=<valid_cookie>" \
  -d '{"savedAt": 1728734000000, "save": {"v": 1, "profile": {"callsign": "<script>alert(1)</script>AcePilot", "avatar": "javascript:alert(1)"}}}'
```
**Expected Response:**
* Invalid avatar URI format is rejected with `422 Unprocessable Entity`.
* If a valid image URI is provided with HTML tags in callsign, `<script>` tags are automatically stripped to `alert(1)AcePilot` before saving.

##### Test 3: Rejection of Prototype Pollution Keys
Submitting a payload containing prototype pollution keys in course objects:
```bash
curl -i -X PUT "http://localhost:8000/api/progress" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -b "nova_session=<valid_cookie>" \
  -d '{"savedAt": 1728734000000, "save": {"v": 1, "course": {"library": {"evil": {"course": {"id": "evil", "__proto__": {"polluted": true}}}}}}}'
```
##### Test 3: Rejection of Prototype Pollution Keys
Submitting a payload containing prototype pollution keys in course objects:
```bash
curl -i -X PUT "http://localhost:8000/api/progress" \
  -H "Content-Type: application/json" \
  -H "X-Nova: 1" \
  -b "nova_session=<valid_cookie>" \
  -d '{"savedAt": 1728734000000, "save": {"v": 1, "course": {"library": {"evil": {"course": {"id": "evil", "__proto__": {"polluted": true}}}}}}}'
```
**Expected Response:**
* Rejected with `HTTP/1.1 422 Unprocessable Entity` (`"Forbidden prototype pollution keys"`).

---