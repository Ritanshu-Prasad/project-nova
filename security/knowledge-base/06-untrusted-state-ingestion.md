# 6. Unvalidated Arbitrary JSON Ingestion on Progress Sync

[← Back to Knowledge Base Index](README.md) | [View Vulnerability](../vulnerabilities/VULN-006-progress-sync-json.md) | [View Patch](../patches/FIX-006-pydantic-schema-validation.md)

---

## 6. Unvalidated Arbitrary JSON Ingestion on Progress Sync

### High-Level Concept
In cloud-synchronized single-page applications, the server often functions as a persistence store for complex client state trees. When the backend blindly persists arbitrary JSON payloads without strict schema validation, malicious actors or client bugs can poison the stored state. When that state is hydrated on other browsers or future sessions, it can cause fatal unhandled exceptions, permanently locking users out of their accounts (Stored Denial of Service).

### Key Points & Mechanics
* **Bypassing the Validation Pipeline:** FastAPI is built on Pydantic, enabling automatic schema checking. However, `put_progress` bypassed Pydantic models completely, reading raw bytes (`await request.body()`) and checking only `isinstance(save, dict)`.
* **Unbounded JSON Dictionary Ingestion:** The client could send arbitrary key-value pairs, nested arrays, deeply nested objects, or non-conforming types inside the `save` object.
* **The Client Hydration Crash Loop:**
  * When a pilot loads Project Nova, `reconcile()` fetches the save from `/api/progress` and executes `applySave(save)`.
  * The frontend code expects strict object shapes:
    ```typescript
    Object.entries(save.course?.library ?? {})
    save.hub?.quizzes.map(...)
    ```
  * If `course.library` is an integer or array instead of an object, or `hub.quizzes` is malformed, JavaScript throws an unhandled `TypeError`.
  * Because this occurs in the main initialization lifecycle, the browser displays a blank white screen. Since the bad state is persisted in the cloud database, the user cannot recover by switching browsers, opening incognito tabs, or restarting their machine.
* **Storage & Memory Resource Exhaustion:** With a 4 MB body ceiling, a user could flood Redis with hundreds of megabytes of junk data across multiple accounts, degrading database throughput.
* **Prototype Pollution Vulnerability:** Unvalidated JSON objects containing keys like `__proto__` or `constructor` can poison JavaScript prototype chains if client-side state managers or deep-merge utilities traverse them.
* **Profile XSS Vector:** The `profile.callsign` and `profile.avatar` fields were persisted without sanitization, permitting raw HTML tags (`<script>`, `<iframe>`) and dangerous URI schemes (`javascript:alert(1)`).
* **Remediation Principle:**
  * **Enforce Strongly Typed Schemas:** Define declarative Pydantic v2 models for every level of the save structure (`PilotSaveModel`, `CourseSyncModel`, `HubSyncModel`, `ProfileSyncModel`).
  * **Bound Metrics & Collections:** Constrain numerical ranges (e.g., XP 0–10M, streak 0–10K), limit collection capacities (library max 60 items, quizzes max 100, tutor threads max 50), and limit string lengths.
  * **Active Sanitization:** Strip HTML formatting from `callsign`, validate that `avatar` is a valid image data URI (capped at 600 KB) or HTTP URL, and validate that `themeColor` is a hex color.
  * **Block Prototype Pollution:** Explicitly reject keys containing `__proto__` or `constructor`.
  * **Fail Fast with Standard Codes:** FastAPI automatically returns `422 Unprocessable Entity` with exact validation failure paths when incoming requests do not adhere to the schema.

---