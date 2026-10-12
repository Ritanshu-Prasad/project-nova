# 9. UTF-16LE Encoded Gitignore & Repository Secret Exposure Risks

[← Back to Knowledge Base Index](README.md) | [View Vulnerability](../vulnerabilities/VULN-009-utf16-gitignore.md) | [View Patch](../patches/FIX-009-utf8-gitignore-rules.md)

---

## 9. UTF-16LE Encoded Gitignore & Repository Secret Exposure Risks

### High-Level Concept
Configuration files for version control systems must adhere to the character encoding expected by those systems. Git natively requires `.gitignore` files to be plain ASCII or UTF-8. When an ignore file is saved with UTF-16 Little Endian (`UTF-16LE`) encoding and a Byte Order Mark (`\xff\xfe`), Git treats the alternating null bytes as corrupted binary or syntax delimiters, completely disabling pattern evaluation and causing sensitive credentials to be staged and committed to public repositories.

### Key Points & Mechanics
* **The Encoding Trap:** Editing files in certain Windows environments or legacy PowerShell redirects (`>` in PowerShell 5.1 outputs UTF-16LE by default) silently encodes text files in UTF-16LE.
* **Git Pattern-Matching Failure:**
  * In UTF-16LE, each ASCII character occupies 2 bytes: the character followed by a null byte `\x00`.
  * Git's pattern matcher evaluates raw bytes. The pattern `_backup*/` becomes `_\x00b\x00a\x00c\x00k\x00u\x00p\x00*\x00/\x00`.
  * Git fails to match filenames against these null-padded sequences. Running `git check-ignore -v` returns `NOT IGNORED` for all patterns.
* **Silent Secret Ingestion into Git:**
  * Developers create local `.env` files with API keys (`NEBIUS_API_KEY`, `SESSION_SECRET`, database tokens).
  * Because the ignore file is non-functional and previously omitted `.env`, running `git add .` or clicking "Stage All" in an IDE stages the `.env` file.
  * Once pushed to GitHub or GitLab, automated credential harvesting bots scrape the repository within seconds, hijacking cloud accounts and incurring massive API charges.
* **Historical Backup Commits:**
  * Deprecated code directories (such as `_backup_landing_v1/`) were accidentally committed to Git because the pattern `_backup*/` was never recognized by Git.
* **CI/CD Scanner Breakage:**
  * Unix command-line utilities (`grep`, `cat`, `sed`, linters) fail to parse UTF-16 files without explicit flags, causing automated CI checks to fail or produce corrupted outputs.
* **Remediation Principle:**
  * **Enforce UTF-8 Without BOM:** Re-encode `.gitignore` in clean UTF-8 with standard Unix line endings (`LF`).
  * **Exhaustive Exclusion Matrix:** Explicitly ignore secrets (`.env*`, `*.pem`, `*.key`), local data (`.data/`), dependencies (`node_modules/`), caches (`__pycache__/`, `.pytest_cache/`), and OS metadata (`.DS_Store`).
  * **Provide Sanitized `.env.example`:** Maintain a tracked `.env.example` template with dummy placeholders to guide developers without leaking credentials.

---