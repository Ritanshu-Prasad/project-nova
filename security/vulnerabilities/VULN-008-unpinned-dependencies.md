# VULN-008: Unpinned Python Dependencies & Supply Chain Exposure

[← Back to Vulnerability Index](README.md) | [View Patch in Patches](../patches/FIX-008-pinned-dependencies-lockfile.md)

---

### VULN-008: Unpinned Python Dependencies & Supply Chain Exposure

* **Severity:** **Low / Supply Chain Integrity** (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:L - Base Score: 3.7)
* **Category:** Software and Data Integrity Failures / Vulnerable and Outdated Components / Supply Chain Risk (CWE-1104, CWE-1395, OWASP A06:2021)
* **Affected Files:**
  * [`backend/requirements.txt`](backend/requirements.txt)
* **Date Identified:** October 12, 2026
* **Status:** **Fixed** (Remediated via [`fixing.md`](fixing.md#fix-008-strict-dependency-pinning-dead-package-pruning--lockfile-generation))

#### 1. Vulnerability Description & Root Cause
In `backend/requirements.txt`, the application previously defined its Python dependencies without exact version pinning (`==`), version ranges, or cryptographic hashes:
```
fastapi
uvicorn
python-multipart
httpx
```

Whenever the application was installed or deployed (in local environments, Docker containers, staging, CI/CD, or serverless Vercel runs), `pip` resolved and downloaded whatever was the latest version available on the Python Package Index (PyPI).

#### 2. Supply Chain & Upstream Poisoning Mechanics
1. **Supply Chain Attacks & Account Compromise:** If an attacker compromises an upstream maintainer account on PyPI (or an abandoned dependency), `pip install` in automated deployment pipelines will unknowingly pull the malicious release.
2. **Build Non-Reproducibility & Deployment Drift:** A build that succeeded on the developer's laptop can fail hours or weeks later in production if a library releases a breaking change, deprecates an internal method, or alters type parsing behaviors.
3. **Re-introduction of Historical CVEs:** Unbounded packages risk pulling versions affected by security advisories. Notably, `python-multipart < 0.0.18` suffered from a known Regular Expression Denial of Service vulnerability (CVE-2024-24762).
4. **Dead Package Attack Surface:** `python-multipart` was initially installed only to handle multipart avatar form uploads in `backend/main.py`. Once those dead upload endpoints were pruned in `FIX-003`, retaining `python-multipart` left an unnecessary parser package exposed in the dependency tree.

#### 3. Attack Vectors & Build Drift Scenarios
* **Scenario A: Breaking Upstream Major Release:** An upstream package such as FastAPI or Starlette releases a major version bump with breaking ASGI or Pydantic syntax changes. A fresh container deployment in production fails during boot, resulting in a production outage.
* **Scenario B: Transitive Dependency Compromise:** A package pulled transitively by an unpinned dependency is hijacked on PyPI to execute arbitrary code during wheel installation or runtime initialization.
* **Scenario C: Exploitation of Known Multipart Vulnerabilities:** Unpinned `python-multipart` exposes the application to parser exploits or ReDoS attacks even though multipart upload endpoints are no longer in use.

#### 4. Impact on Project Nova
* Vulnerability to upstream supply chain attacks and malicious PyPI updates.
* Non-deterministic production builds leading to unexpected deployment failures.
* Unnecessary attack surface from unneeded dependencies.

---