# VULN-009: UTF-16LE Encoded Gitignore & Repository Secret Exposure Risks

[← Back to Vulnerability Index](README.md) | [View Patch in Patches](../patches/FIX-009-utf8-gitignore-rules.md)

---

### VULN-009: UTF-16LE Encoded Gitignore & Repository Secret Exposure Risks

* **Severity:** **Medium / Repository Hygiene** (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N - Base Score: 6.5)
* **Category:** Security Misconfiguration / Sensitive Data Exposure / Repository Hygiene (CWE-312, CWE-200, OWASP A01:2021)
* **Affected Files:**
  * [`.gitignore`](.gitignore)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-009-utf-8-re-encoding-of-gitignore--comprehensive-secret-exclusion))

#### 1. Vulnerability Description & Root Cause
The root `.gitignore` file was originally authored in Windows PowerShell or an editor that saved the file in **UTF-16 Little Endian (`UTF-16LE`) with Byte Order Mark (`BOM: \xff\xfe`)** and Windows CRLF line terminators.

Git's pattern-matching parser strictly expects repository control files to be encoded in **UTF-8 (or 7-bit ASCII)** with Unix line endings (`LF`). 

Because UTF-16LE represents ASCII characters with alternating null bytes (e.g. `_ \x00 b \x00 a \x00 c \x00 k \x00 u \x00 p \x00`), Git's internal pattern matcher fails to parse the file or interprets the null bytes as binary delimiters. Running `git check-ignore -v <path>` on patterns present in the file returned `NOT IGNORED`, completely invalidating all repository exclusion rules.

Furthermore, the original `.gitignore` contained only two lines (`_backup*/` and `*backup*/`), omitting standard exclusions for sensitive configuration files (`.env`, `.env.*`), private keys, local databases, build artifacts, and OS metadata.

#### 2. Git Parser Invalidation & Secret Exposure Mechanics
1. **Silent Pattern Invalidation:** When Git reads a UTF-16LE `.gitignore`, it treats the file as either corrupt binary or an unparseable pattern. None of the listed paths are ignored.
2. **Accidental Credential Staging (`git add .`):** Developers routinely create `.env` or `.env.local` files in the workspace to store real production credentials, including:
   * `SESSION_SECRET` (used for cryptographic HMAC token signing)
   * `NEBIUS_API_KEY` (paid inference API key)
   * `KV_REST_API_TOKEN` / Upstash Redis keys
   * Google OAuth client secrets
3. Because Git does not ignore `.env`, running `git add .` or committing through VS Code or IDE Git extensions stages the entire `.env` file into Git staging.
4. Once committed and pushed to GitHub or GitLab, API keys and secrets are immediately scraped by automated credential harvesting bots, resulting in billing theft, unauthorized database access, and total platform compromise.

#### 3. Attack Vectors & Exploitation Scenarios
* **Scenario A: Public Secret Leakage via IDE Commit:** A developer sets up a local `.env` with their personal Nebius AI key and Redis tokens. They stage changes with `git add .` and push to GitHub. Automated crawlers scrape the key within minutes, exhausting the developer's cloud credit balance.
* **Scenario B: Sensitive Backup Exposure:** Directories like `_backup_landing_v1/` containing old code, internal documentation, or test tokens were committed directly into the Git repository because Git failed to honor the UTF-16LE `_backup*/` ignore directive.
* **Scenario C: CI/CD Pipeline and Tooling Incompatibility:** Automated Unix tools (`grep`, `awk`, `cat`, pre-commit hooks) in CI/CD pipelines fail or output garbage when processing UTF-16LE text without special decoding flags, causing CI security scans to silently pass or fail with cryptic syntax errors.

#### 4. Impact on Project Nova
* Critical risk of public secret leakage on GitHub.
* Total failure of Git ignore mechanics across the entire repository.
* Repository bloat and inclusion of untracked test scripts and build artifacts.