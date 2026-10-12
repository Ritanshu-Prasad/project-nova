# Project Nova — Security Fixes & Patch Log

This directory contains modular patch logs, code diffs, and verification tests for each of the 9 implemented security fixes.

[← Back to Security Hub](../README.md) | [Go to Vulnerability Register](../vulnerabilities/README.md) | [Go to Knowledge Base](../knowledge-base/README.md)

---

## Applied Patches Index

| Fix ID | Target Vulnerability | Description | Modular Patch File | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FIX-001** | **VULN-001** | Strict CORS Origin Whitelisting & Header Restriction | [`FIX-001-strict-cors-whitelist.md`](FIX-001-strict-cors-whitelist.md) | **Applied & Verified** |
| **FIX-002** | **VULN-002** | AI Tutor Authentication, Rate Limiting & Prompt Injection Guardrails | [`FIX-002-ai-tutor-guardrails.md`](FIX-002-ai-tutor-guardrails.md) | **Applied & Verified** |
| **FIX-003** | **VULN-003** | Removal of Dangling File Upload Endpoints & Static Mount | [`FIX-003-remove-dangling-uploads.md`](FIX-003-remove-dangling-uploads.md) | **Applied & Verified** |
| **FIX-004** | **VULN-004** | Multi-Layered Environment Gating & Input Validation for Dev Login | [`FIX-004-dev-login-gating.md`](FIX-004-dev-login-gating.md) | **Applied & Verified** |
| **FIX-005** | **VULN-005** | Leaderboard Concurrency Locking, Submission Throttling & Delta Validation | [`FIX-005-leaderboard-locks-throttling.md`](FIX-005-leaderboard-locks-throttling.md) | **Applied & Verified** |
| **FIX-006** | **VULN-006** | Pydantic Schema Validation & Bound Enforcement for Progress Sync | [`FIX-006-pydantic-schema-validation.md`](FIX-006-pydantic-schema-validation.md) | **Applied & Verified** |
| **FIX-007** | **VULN-007** | Persistent Local Secret & Fail-Fast Production Startup Validation | [`FIX-007-persistent-dev-secret.md`](FIX-007-persistent-dev-secret.md) | **Applied & Verified** |
| **FIX-008** | **VULN-008** | Strict Dependency Pinning, Dead Package Pruning & Lockfile Generation | [`FIX-008-pinned-dependencies-lockfile.md`](FIX-008-pinned-dependencies-lockfile.md) | **Applied & Verified** |
| **FIX-009** | **VULN-009** | UTF-8 Re-Encoding of Gitignore & Comprehensive Secret Exclusion | [`FIX-009-utf8-gitignore-rules.md`](FIX-009-utf8-gitignore-rules.md) | **Applied & Verified** |

---

> Master document available at [`security/fixing.md`](../fixing.md).
