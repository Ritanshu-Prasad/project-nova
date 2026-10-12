# 8. Unpinned Python Dependencies & Supply Chain Exposure

[← Back to Knowledge Base Index](README.md) | [View Vulnerability](../vulnerabilities/VULN-008-unpinned-dependencies.md) | [View Patch](../patches/FIX-008-pinned-dependencies-lockfile.md)

---

## 8. Unpinned Python Dependencies & Supply Chain Exposure

### High-Level Concept
Modern applications rely heavily on open-source packages. In the Python ecosystem (pip / PyPI), leaving dependencies "unpinned" (without explicit versions like `==1.2.3` or hashes) means package managers will fetch whatever latest version is available when a build or deployment runs. This opens the door to **upstream supply chain attacks**, **build drift**, and **unexpected breaking changes** that can crash production deployments.

### Key Points & Mechanics
* **Unpinned Requirements Anti-Pattern:** Listing bare package names (`fastapi`, `uvicorn`, `httpx`) delegates version choice to PyPI at install time.
* **Supply Chain Hijacking Risk:**
  * If an attacker compromises a maintainer account on PyPI or takes over an abandoned dependency, they can publish a malicious minor or patch release.
  * Any subsequent deployment or build command automatically downloads and executes the compromised code.
* **Deployment Drift ("Works on My Machine"):**
  * When developers test their code locally on version X, but production installs version Y released hours later, subtle breaking changes or syntax deprecations cause production outages.
* **Dead Dependencies Expand Attack Surface:**
  * Packages like `python-multipart` were originally included for features that were later removed (e.g., file upload endpoints).
  * Retaining unneeded dependencies exposes the application to unpatched CVEs in those libraries (such as `python-multipart < 0.0.18` ReDoS CVE-2024-24762).
* **Remediation Principle:**
  * **Exact Version Pinning:** Use `==` operators for all primary dependencies in `requirements.txt`.
  * **Prune Unused Libraries:** Remove orphaned packages that are no longer imported by application code.
  * **Generate Full Lockfiles:** Maintain a `requirements.lock` file that captures the exact versions of all primary and transitive dependencies for 100% reproducible builds.
  * **Continuous CVE Scanning:** Incorporate automated scanning tools (`pip-audit`, Dependabot) into CI/CD pipelines to catch vulnerabilities in pinned versions as new CVEs are published.

---