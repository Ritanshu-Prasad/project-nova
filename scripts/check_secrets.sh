#!/bin/sh
# Stops a push that would publish a secret: looks through every tracked file for the shapes of the keys this
# project uses. Run it by hand with `sh scripts/check_secrets.sh`; the pre-push hook runs it too.

PATTERNS='AKIA[0-9A-Z]{16}|v1\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}|postgres(ql)?://[^:/[:space:]]+:[^@[:space:]]{6,}@|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'

# The template and the docs only ever hold placeholders; this file holds the patterns themselves.
found=$(git grep -nEI "$PATTERNS" -- . ':!.env.example' ':!docs' ':!scripts/check_secrets.sh' ':!*package-lock.json')

if [ -n "$found" ]; then
  echo "❌ [Secret Guard] Something that looks like a secret is committed:"
  echo "$found" | cut -c1-120
  echo "👉 Remove it, rotate the key, and keep real values in .env (never committed)."
  exit 1
fi

echo "✅ [Secret Guard] No secrets found in tracked files."
