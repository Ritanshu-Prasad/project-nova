# Seeing what the model does and what it costs

NOVA uses one model, **NVIDIA Nemotron 3 Nano 30B-A3B on Nebius Token Factory**. Any other model in the settings is replaced by Nano and reported as an error at startup (`NOVA_ALLOWED_MODELS` widens that on purpose).

## Where to look

| You want to know | Look here |
|---|---|
| What was actually charged, balance, budgets | Nebius console: **Billing → Usage** (filter by service and product) and **Budgets** for email alerts. See Nebius's [usage](https://docs.nebius.com/signup-billing/usage/view.md) and [budgets](https://docs.nebius.com/signup-billing/budgets.md) pages. A per-API-key or per-model breakdown for Token Factory is not documented; ask Nebius support if you need one. |
| When the model was used, tokens in and out, estimated cost, per kind of call and per day | **`/admin`** on the backend (needs `NOVA_ADMIN_TOKEN`), or `GET /api/admin/usage?days=7` with `Authorization: Bearer <token>` |
| The same numbers for Grafana or any scraper | `GET /api/admin/metrics` (Prometheus text, same token) |
| What one request cost | The backend log line: `POST /api/courses/generate -> 200 (8009 ms) [calls=5 tokens=4959 ~$0.0008 retries=0]` |
| What one course cost to write | `course.meta`: `calls`, `tokens`, `costUsd`, plus the `model` and `promptVersion` that wrote it |
| Which models and switches this server runs with | The `Models: ...` line at startup, and `GET /api/health` |
| How good the output is | `backend/evals` (see its README section below) |

## The price is an estimate
Cost = input tokens × input price + output tokens × output price. The defaults, **$0.06 and $0.24 per million tokens**, are the public listing for Nemotron 3 Nano on Nebius as shown by third-party directories ([example](https://custom.typingmind.com/tools/estimate-llm-usage-costs/nebius/nvidia-nemotron-3-nano-30b-a3b)); I found no Nebius page that confirms them. Set `NOVA_PRICE_INPUT_PER_M` and `NOVA_PRICE_OUTPUT_PER_M` to the numbers in your Nebius console. Compare the admin page with Billing → Usage after a day of use to see how close it is.

## The admin page
Set `NOVA_ADMIN_TOKEN` to any long random string (for example `openssl rand -hex 24`), restart, open `http://localhost:8000/admin` and paste the token. It is kept in your browser tab only and sent as a header; it is never put in a URL. Without the token setting the three admin routes answer 404.

It shows today's calls, tokens, estimated cost, retries and failures, the budget bar when `NOVA_DAILY_TOKEN_BUDGET` is set, a table per kind of call (outline, lesson, quiz, answers, safety, tutor, ...), and a table per day with cache hits and turned-away requests.

## Where the numbers are kept
Every model call adds to a counter for its day, model and kind: calls, prompt tokens, completion tokens, time and a latency bucket (up to 1 s, 3 s, 10 s, 30 s, slower), plus retries and failures. They live in the shared store (Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, otherwise in memory and lost on restart) and are kept 90 days. No prompts, goals or user identifiers are stored in the counters.

## Logs
- Default: readable lines with a request id, for example `[8753aef37695] POST /api/courses/generate -> 200 (7674 ms) [calls=5 ...]`. The id is also returned in the `X-Request-ID` header and accepted from the caller.
- `LOG_FORMAT=json`: one JSON object per line with `time`, `level`, `logger`, `request_id`, `message` and, for requests that used the model, a `usage` object. Use this with a log service.
- `NOVA_LOG_PROMPTS=on`: also saves each prompt and reply (cut to 2,000 characters) to `backend/.data/prompts.jsonl`, tied to the request id. It keeps what learners typed, so it is for local debugging only and is ignored when `VERCEL` is set.
- `LOG_LEVEL=DEBUG` adds a line per model call with its tokens and time.

## Warnings worth watching for
- `... is not an allowed model, using ... Nano instead`: a setting asked for another model.
- `Daily token budget is 80% used`: logged once (and posted to `NOVA_ALERT_WEBHOOK`, a Slack-style webhook, when set) when the day's tokens cross 80% of `NOVA_DAILY_TOKEN_BUDGET`; at 100% new work is refused with a 503 until the next UTC day.
- `Unusable model answer`: the model's JSON failed validation and was asked for again; a high count means a prompt or model problem (the eval suite measures it as the first-try rate).
