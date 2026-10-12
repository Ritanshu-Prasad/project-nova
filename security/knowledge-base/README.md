# Project Nova — Security Knowledge Base & Educational Guide

This directory contains modular reference cards explaining the concepts, attack vectors, root causes, and defensive architecture behind each vulnerability resolved in Project Nova.

[← Back to Security Hub](../README.md) | [Go to Vulnerability Register](../vulnerabilities/README.md) | [Go to Patches Log](../patches/README.md)

---

## Quick Reference Index

| # | Topic | Category | Risk Level | Guide File |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Reflected Origin CORS with Credentials & CSRF Bypass | Access Control & CORS | **Critical** (8.1) | [`01-cors-csrf-fundamentals.md`](01-cors-csrf-fundamentals.md) |
| **2** | Unauthenticated, Unmetered AI Tutor Proxy & Prompt Injection | Auth & LLM Security | **High** (8.2) | [`02-llm-security-prompt-isolation.md`](02-llm-security-prompt-isolation.md) |
| **3** | Dangling Public File Uploads & Public Static Mount | Resource & Attack Surface | **High** (7.1) | [`03-attack-surface-reduction.md`](03-attack-surface-reduction.md) |
| **4** | Insecure Developer Authentication Backdoor | Broken Authentication | **Medium** (6.5) | [`04-dev-authentication-backdoors.md`](04-dev-authentication-backdoors.md) |
| **5** | Unverified Self-Reported Scores & Leaderboard Concurrency Defect | Input Trust & Race Condition | **Medium** (6.5) | [`05-race-conditions-and-client-trust.md`](05-race-conditions-and-client-trust.md) |
| **6** | Unvalidated Arbitrary JSON Ingestion on Progress Sync | Input Validation & Stored DoS | **Medium** (6.8) | [`06-untrusted-state-ingestion.md`](06-untrusted-state-ingestion.md) |
| **7** | Ephemeral Dev Secret Fallback & Session Drop on Scale | Cryptography & Scaling | **Low** (3.7) | [`07-stateless-secrets-and-scale.md`](07-stateless-secrets-and-scale.md) |
| **8** | Unpinned Python Dependencies & Supply Chain Exposure | Supply Chain & Integrity | **Low** (3.7) | [`08-supply-chain-hygiene.md`](08-supply-chain-hygiene.md) |
| **9** | UTF-16LE Encoded Gitignore & Repository Secret Exposure Risks | Repository Hygiene & Secrets | **Medium** (6.5) | [`09-repository-hygiene-and-secrets.md`](09-repository-hygiene-and-secrets.md) |

---

## Summary of Core Security Principles Learned

1. **Never Trust the Client:** Client headers (`Origin`, `Content-Type`, `User-Agent`), client-reported scores, and client-generated save states can be manipulated by attackers.
2. **Eliminate Dead Code:** Unused endpoints and unused dependencies are liabilities; delete orphaned routes and libraries immediately.
3. **Bound LLM Contexts:** Treat user-supplied LLM inputs as untrusted and wrap them in clear architectural delimiters.
4. **Defense in Depth:** Do not rely on a single environment variable to gate administrative or debug capabilities.
5. **Protect Concurrency:** Shared state must be mutated atomically using locks or atomic database commands to avoid silent data loss.
6. **Strict Schema Contracts:** Never accept arbitrary unstructured JSON. Enforce declarative schemas, bounds, and sanitizers at the API boundary to prevent stored corruption and client crash loops.
7. **Deterministic Cryptographic Keys & Fail-Fast Bootstrapping:** Never rely on ephemeral, in-memory secrets for signing tokens across distributed or multi-worker systems. Persist local development secrets deterministically and fail fast on startup if production credentials are weak or missing.
8. **Supply Chain Rigor & Deterministic Dependency Graphs:** Pin all dependencies with exact versions and frozen transitive lockfiles to prevent unexpected breaking changes, non-reproducible builds, and malicious upstream package injection.
9. **Repository Hygiene & Pre-Commit Secret Defense:** Ensure repository control files are encoded in standard UTF-8, enforce comprehensive secret exclusion patterns, and maintain sanitized templates (`.env.example`) to prevent irreversible public credential leaks.

---

> Master document available at [`security/vul-info.md`](../vul-info.md).
