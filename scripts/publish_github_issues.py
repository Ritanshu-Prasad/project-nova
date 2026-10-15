#!/usr/bin/env python3
"""
Project NOVA - Automated GitHub Issue Publisher
Reads all structured markdown issue specifications in .github/issues/ and publishes
them directly to https://github.com/Ritanshu-Prasad/project-nova/issues via the GitHub REST API.
Automatically detects and skips issues that already exist on GitHub.

Usage:
    # 1. Test/validate all issues without publishing (Dry Run):
    python scripts/publish_github_issues.py --dry-run

    # 2. Publish new issues using an environment variable:
    set GITHUB_TOKEN=ghp_yourPersonalAccessToken
    python scripts/publish_github_issues.py

    # 3. Publish interactively:
    python scripts/publish_github_issues.py
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

REPO_OWNER = "Ritanshu-Prasad"
REPO_NAME = "project-nova"
API_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/issues"
ISSUES_DIR = Path(__file__).resolve().parent.parent / ".github" / "issues"


def parse_issue_file(path: Path) -> dict:
    """Parses title, labels, and markdown body from an issue file."""
    content = path.read_text(encoding="utf-8")
    lines = content.splitlines()

    # Extract title from the first level-1 heading
    title = ""
    for line in lines:
        if line.startswith("# "):
            title = line[2:].strip()
            break
    if not title:
        title = path.stem.replace("_", " ").title()

    # Extract labels from **Labels:** line
    labels = ["backend"]
    for line in lines:
        match = re.search(r"\*\*Labels:\*\*\s*(.+)", line)
        if match:
            raw_labels = match.group(1).replace("`", "").split(",")
            labels = [lbl.strip() for lbl in raw_labels if lbl.strip()]
            break

    return {
        "file": path.name,
        "title": title,
        "labels": labels,
        "body": content.strip()
    }


def get_existing_issue_titles(token: str) -> set[str]:
    """Fetches all existing issue titles to ensure idempotency."""
    req = urllib.request.Request(
        f"{API_URL}?state=all&per_page=100",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Project-Nova-Issue-Publisher"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            issues = json.loads(resp.read().decode("utf-8"))
            return {i["title"].strip().lower() for i in issues if "title" in i}
    except Exception as e:
        print(f"[WARN] Could not fetch existing issues: {e}. Will attempt publishing all.")
        return set()


def publish_issue(issue_data: dict, token: str) -> str:
    """Publishes a single issue to GitHub via the REST API."""
    payload = {
        "title": issue_data["title"],
        "body": issue_data["body"],
        "labels": issue_data["labels"]
    }
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data_bytes,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Project-Nova-Issue-Publisher",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            return resp_data.get("html_url", "")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"GitHub API Error ({e.code}): {err_msg}") from e


def main():
    dry_run = "--dry-run" in sys.argv
    print("[INFO] Project NOVA - GitHub Issue Publisher")
    print(f"[INFO] Scanning directory: {ISSUES_DIR}\n")

    if not ISSUES_DIR.exists():
        print(f"[ERROR] {ISSUES_DIR} does not exist!")
        sys.exit(1)

    issue_files = sorted(ISSUES_DIR.glob("*.md"))
    if not issue_files:
        print(f"[ERROR] No .md issue files found in {ISSUES_DIR}")
        sys.exit(1)

    parsed_issues = [parse_issue_file(f) for f in issue_files]

    print(f"[INFO] Found {len(parsed_issues)} issue specifications in directory:")
    for idx, issue in enumerate(parsed_issues, 1):
        print(f"  {idx}. [{', '.join(issue['labels'])}] {issue['title']} ({issue['file']})")

    if dry_run:
        print("\n[SUCCESS] DRY RUN COMPLETE: All issue files are valid and ready to publish.")
        print("[INFO] To publish to GitHub, run without --dry-run and provide a GitHub Personal Access Token.")
        sys.exit(0)

    # Obtain token
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if not token:
        print("\n[KEY] GitHub Personal Access Token (PAT) required with 'repo' scope.")
        print("[INFO] Generate one at: https://github.com/settings/tokens (classic token with 'repo' checked)")
        try:
            token = input("Enter your GitHub Token (or press Ctrl+C to cancel): ").strip()
        except KeyboardInterrupt:
            print("\nAborted.")
            sys.exit(0)

    if not token:
        print("[ERROR] GitHub Token cannot be empty.")
        sys.exit(1)

    # Check existing issues to avoid duplicates
    print("\n[INFO] Checking existing issues on GitHub...")
    existing_titles = get_existing_issue_titles(token)
    print(f"[INFO] Found {len(existing_titles)} existing issues on repository.")

    print("\n[INFO] Publishing new issues to GitHub...\n")
    success_count = 0
    skipped_count = 0

    for idx, issue in enumerate(parsed_issues, 1):
        if issue["title"].strip().lower() in existing_titles:
            print(f"[SKIP] Issue already exists: {issue['title']}")
            skipped_count += 1
            continue

        print(f"Publishing {idx}/{len(parsed_issues)}: {issue['title']}...", end=" ", flush=True)
        try:
            url = publish_issue(issue, token)
            print(f"[OK] Created -> {url}")
            success_count += 1
            time.sleep(1)  # Respect API rate limits
        except Exception as e:
            print(f"[FAIL] Error: {e}")

    print(f"\n[SUMMARY] Finished: Created {success_count} new issues ({skipped_count} skipped) out of {len(parsed_issues)} total on {REPO_OWNER}/{REPO_NAME}.")


if __name__ == "__main__":
    main()
