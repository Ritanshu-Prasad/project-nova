# FIX-009: UTF-8 Re-Encoding of Gitignore & Comprehensive Secret Exclusion

[← Back to Patches Index](README.md) | [View Target Vulnerability](../vulnerabilities/VULN-009-utf16-gitignore.md)

---

### FIX-009: UTF-8 Re-Encoding of Gitignore & Comprehensive Secret Exclusion

* **Target Vulnerability:** [`VULN-009`](vulnerabilities.md#vuln-009-utf-16le-encoded-gitignore--repository-secret-exposure-risks) (Medium / Repository Hygiene — UTF-16LE Encoded Gitignore & Repository Secret Exposure Risks)
* **Component / File:** [`.gitignore`](.gitignore), [`.env.example`](.env.example)
* **Date Applied:** October 12, 2026
* **Status:** **Applied & Verified**

---

#### 1. Problem Summary
The root `.gitignore` was saved in Windows **UTF-16 Little Endian (`UTF-16LE`) with Byte Order Mark (`\xff\xfe`)** and CRLF line endings. Because Git's pattern matcher natively expects UTF-8 or ASCII text, the alternating null bytes between characters caused Git to treat the file as corrupted binary, completely invalidating all repository ignore rules (e.g. `git check-ignore` failed to ignore paths listed in the file).

Furthermore, `.gitignore` omitted rules for `.env`, `.env.*`, `node_modules/`, `dist/`, `.data/`, and Python caches, creating a severe risk that local secrets (`SESSION_SECRET`, `NEBIUS_API_KEY`, Upstash Redis keys) would be staged and pushed to public GitHub repositories via `git add .`.

---

#### 2. Remediation Strategy & Steps Taken
1. **UTF-8 Conversion & Byte-Order Normalization:** Rewrote `.gitignore` in clean UTF-8 encoding with Unix line endings (`LF`) and no BOM markers.
2. **Comprehensive Exclusion Matrix:** Added exhaustive protection rules across all relevant risk categories:
   * **Secrets & Keys:** `.env`, `.env.*`, `*.env`, `*.pem`, `*.key`, `*.cert`.
   * **Whitelisted Template:** Allowed `.env.example` via explicit `!.env.example` negation.
   * **Application Data:** `.data/`, `backend/.data/`, `*.sqlite3`, `*.db`.
   * **Node & Frontend Artifacts:** `node_modules/`, `frontend/node_modules/`, `dist/`, debug logs.
   * **Python Artifacts:** `__pycache__/`, `*.py[cod]`, `.venv/`, `.pytest_cache/`.
   * **OS & Editor Metadata:** `.DS_Store`, `.idea/`, `.vscode/`, `*.swp`.
3. **Environment Template (`.env.example`):** Created a safe, sanitized template demonstrating required environment variables (`ENVIRONMENT`, `SESSION_SECRET`, `ALLOWED_ORIGINS`, `NEBIUS_API_KEY`, `GOOGLE_CLIENT_ID`) with clear instructions to prevent accidental secret commits.

---

#### 3. Code Diff Applied

```diff
--- a/.gitignore
+++ b/.gitignore
@@ -1,2 +1,78 @@
-# (Previously encoded as UTF-16LE with BOM \xff\xfe, completely ignored by Git)
-_backup*/
-*backup*/
+# ==============================================================================
+# Project Nova — Root Git Ignore Configuration (UTF-8, LF)
+# ==============================================================================
+
+# ── Secrets & Environment Variables (CRITICAL) ────────────────────────────────
+.env
+.env.*
+*.env
+!.env.example
+*.pem
+*.key
+*.cert
+*.crt
+*.pfx
+*.p12
+
+# ── Local Application Stores & Data ──────────────────────────────────────────
+.data/
+backend/.data/
+*.sqlite
+*.sqlite3
+*.db
+
+# ── Python Artifacts & Virtual Environments ──────────────────────────────────
+__pycache__/
+*.py[cod]
+*$py.class
+*.so
+.Python
+build/
+develop-eggs/
+dist/
+downloads/
+eggs/
+.eggs/
+lib/
+lib64/
+parts/
+sdist/
+var/
+wheels/
+*.egg-info/
+.installed.cfg
+*.egg
+.venv/
+venv/
+ENV/
+env/
+.pytest_cache/
+.mypy_cache/
+.ruff_cache/
+
+# ── Node.js & Frontend Artifacts ─────────────────────────────────────────────
+node_modules/
+frontend/node_modules/
+npm-debug.log*
+yarn-debug.log*
+yarn-error.log*
+pnpm-debug.log*
+lerna-debug.log*
+frontend/dist/
+frontend/dist-ssr/
+
+# ── Operating System & Editor Metadata ───────────────────────────────────────
+.DS_Store
+.DS_Store?
+._*
+.Spotlight-V100
+.Trashes
+ehthumbs.db
+Thumbs.db
+.idea/
+.vscode/
+*.swp
+*.swo
+*~
+
+# ── Temporary & Scratch Files ────────────────────────────────────────────────
+*.log
+scratch/
+tmp/
+*.tmp
+
+# ── Backups ──────────────────────────────────────────────────────────────────
+_backup*/
+*backup*/
```

---

#### 4. Verification & Testing

##### Test 1: File Encoding Verification
Verify that `.gitignore` is recognized by Unix `file` as standard UTF-8 text without BOM:
```bash
file .gitignore
```
**Result:** Verified: `.gitignore: Unicode text, UTF-8 text`.

##### Test 2: Active Secret & Environment Exclusion Check
Verify that Git actively matches and ignores sensitive `.env` files:
```bash
git check-ignore -v .env .env.local backend/.data/accounts.json
```
**Result:** Verified:
* `.gitignore:8:*.env    .env`
* `.gitignore:7:.env.*   .env.local`
* `backend/.gitignore:2:.data/   backend/.data/accounts.json`

##### Test 3: Template Inclusion Verification
Verify that `.env.example` remains unignored and safely trackable:
```bash
git check-ignore -v .env.example
```
**Result:** Verified: `.gitignore:9:!.env.example    .env.example` (negation rule actively matches).