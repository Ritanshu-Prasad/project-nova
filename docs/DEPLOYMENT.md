# Deploying NOVA

NOVA is one Vercel project with two services (see `vercel.json`): the Vite frontend, and the FastAPI backend in `backend/`. Requests to `/api/...` go to the backend and everything else to the frontend. That is why the admin page lives at `/api/admin`.

## What the deployment needs

Set these in the Vercel project (names only; never commit values):

| Setting | Why |
|---|---|
| `NEBIUS_API_KEY` | the model; without it course routes answer 503 |
| `SESSION_SECRET` | signs sign-in cookies; without it accounts answer 503 |
| `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_AUTH=on` | Google sign-in; the OAuth client must list the site's address as an authorized JavaScript origin |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*` pair) | accounts, rate limits, caches, usage records; without them each serverless instance forgets everything |
| `DATABASE_URL` (optional) | Postgres (Neon) for accounts instead of Redis |
| `NOVA_ADMIN_TOKEN` | turns on `/api/admin` |
| `NOVA_DAILY_TOKEN_BUDGET`, `NOVA_ALERT_WEBHOOK` | a spending limit and a message when 80% of it is used |

`.env.example` lists every switch with its meaning.

## How long things take

Measured on the Nano model: an outline about 8 seconds, one topic (lesson and question bank) about 20 seconds, and a two-topic document course about 50 seconds. A larger PDF takes longer because each topic is written separately.

Vercel Functions have a default maximum duration that depends on the plan; Fluid compute is on for new projects. Vercel's documentation shows how to raise it with `functions` in `vercel.json` keyed by the entrypoint file, but it does not describe how that key works with the `services` layout used here, so `vercel.json` sets nothing. If a long document course times out on a preview deployment, add `"functions": {"backend/main.py": {"maxDuration": 120}}`, deploy a preview, and confirm a long generation finishes before merging.

## Checks that run on every push

`.github/workflows/verify-and-sync.yml`: secret scan, pyflakes, backend tests, oxlint, frontend unit tests, the contract check, the production build, the browser tests, and a non-blocking dependency audit (`pip-audit` on `backend/requirements.lock`, `npm audit`). The branch `stable`, which Vercel deploys, is updated only when the build and browser tests pass.

`backend/requirements.lock` holds the exact versions of the backend's dependencies; CI installs with them as constraints. Refresh it after changing `requirements.txt`: install into an empty virtual environment and run `pip freeze > backend/requirements.lock`.

## Model checks

`.github/workflows/evals.yml` is run by hand (or weekly) and needs the `NEBIUS_API_KEY` repository secret. A smoke run of every suite costs about six cents on Nano. See `backend/evals/README.md`.
