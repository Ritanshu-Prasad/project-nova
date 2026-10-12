# Project Nova — Vulnerability Register & Threat Matrix

This directory contains modular security advisories for each of the 9 identified vulnerabilities in Project Nova.

[← Back to Security Hub](../README.md) | [Go to Patches Log](../patches/README.md) | [Go to Knowledge Base](../knowledge-base/README.md)

---

## Vulnerability Index

| ID | Title | Severity | Component | Modular File | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **VULN-001** | Reflected Origin CORS with Credentials & CSRF Bypass | **Critical** | `backend/main.py`, `backend/accounts.py` | [`VULN-001-cors-csrf-bypass.md`](VULN-001-cors-csrf-bypass.md) | **Fixed** |
| **VULN-002** | Unauthenticated, Unmetered AI Tutor Proxy & Prompt Injection | **High** | `backend/main.py`, `frontend/src/core/tutor.ts` | [`VULN-002-unmetered-ai-tutor.md`](VULN-002-unmetered-ai-tutor.md) | **Fixed** |
| **VULN-003** | Dangling Public File Uploads & Public Static Mount | **High** | `backend/main.py` | [`VULN-003-dangling-file-uploads.md`](VULN-003-dangling-file-uploads.md) | **Fixed** |
| **VULN-004** | Insecure Developer Authentication Backdoor | **Medium** | `backend/accounts.py` | [`VULN-004-dev-auth-backdoor.md`](VULN-004-dev-auth-backdoor.md) | **Fixed** |
| **VULN-005** | Unverified Self-Reported Scores & Leaderboard Concurrency Defect | **Medium** | `backend/fleet.py`, `frontend/src/core/fleet.ts` | [`VULN-005-leaderboard-concurrency.md`](VULN-005-leaderboard-concurrency.md) | **Fixed** |
| **VULN-006** | Unvalidated Arbitrary JSON Ingestion on Progress Sync | **Medium** | `backend/accounts.py`, `frontend/src/core/account.ts` | [`VULN-006-progress-sync-json.md`](VULN-006-progress-sync-json.md) | **Fixed** |
| **VULN-007** | Ephemeral Dev Secret Fallback & Session Drop on Scale | **Low** | `backend/accounts.py` | [`VULN-007-ephemeral-dev-secret.md`](VULN-007-ephemeral-dev-secret.md) | **Fixed** |
| **VULN-008** | Unpinned Python Dependencies & Supply Chain Exposure | **Low** | `backend/requirements.txt` | [`VULN-008-unpinned-dependencies.md`](VULN-008-unpinned-dependencies.md) | **Fixed** |
| **VULN-009** | UTF-16LE Encoded Gitignore & Repository Secret Exposure Risks | **Medium** | `.gitignore` | [`VULN-009-utf16-gitignore.md`](VULN-009-utf16-gitignore.md) | **Fixed** |

---

> Master document available at [`security/vulnerabilities.md`](../vulnerabilities.md).
