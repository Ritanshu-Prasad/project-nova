# Seeing what the model does and what it costs

NOVA uses three models on Nebius Token Factory: **DeepSeek-V4-Flash-0731 plans courses** (modules, topics and changes to the plan; if it is unavailable the call is asked of Lightning instead), and **NVIDIA Nemotron 3.5 Lightning** writes the lessons, the question banks and the placement quiz, checks answers and goals, and runs the tutor. Settings: `NOVA_PLAN_MODEL`, `NOVA_CONTENT_MODEL`, `NOVA_BANK_MODEL`, `NOVA_TUTOR_MODEL` (Nano is still allowed, for rolling back). Any other model in the settings is replaced by that stage's default and reported as an error at startup (`NOVA_ALLOWED_MODELS` widens that on purpose).

## Where to look

| You want to know | Look here |
|---|---|
| What was actually charged, balance, budgets | Nebius console: **Billing → Usage** (filter by service and product) and **Budgets** for email alerts. See Nebius's [usage](https://docs.nebius.com/signup-billing/usage/view.md) and [budgets](https://docs.nebius.com/signup-billing/budgets.md) pages. A per-API-key or per-model breakdown for Token Factory is not documented; ask Nebius support if you need one. |
| When the model was used, tokens in and out, estimated cost, per kind of call and per day | **`/api/admin`** (also `/admin` on the backend directly; needs `NOVA_ADMIN_TOKEN`), or `GET /api/admin/usage?days=7` with `Authorization: Bearer <token>` |
| The same numbers for Grafana or any scraper | `GET /api/admin/metrics` (Prometheus text, same token) |
| What one request cost | The backend log line: `POST /api/courses/generate -> 200 (8009 ms) [calls=5 tokens=4959 ~$0.0008 retries=0]` |
| What one course cost to write | `course.meta`: `calls`, `tokens`, `costUsd`, plus the `model` and `promptVersion` that wrote it |
| Which models and switches this server runs with | The `Models: ...` line at startup, and `GET /api/health` |
| How good the output is | `backend/evals` (see its README section below) |

## The price is an estimate
Cost = input tokens × input price + output tokens × output price. Each model is priced at its listing in the [Nebius Token Factory catalog](https://tokenfactory.nebius.com/model-catalog.md): **Nemotron 3.5 Lightning and Nemotron 3 Nano $0.06 in / $0.24 out per million tokens, DeepSeek-V4-Flash-0731 $0.14 in / $0.28 out** (its cheaper cached-input rate is not counted separately, so the estimate can only be slightly high). Every call is priced with the model it used (see `price_per_million_by_model` in the usage report). To override, set `NOVA_PRICE_INPUT_PER_M` and `NOVA_PRICE_OUTPUT_PER_M` to the numbers in your Nebius console; they then apply to every model. Compare the admin page with Billing → Usage after a day of use to see how close it is.

## The admin page
Set `NOVA_ADMIN_TOKEN` to any long random string (for example `openssl rand -hex 24`), restart, open `http://localhost:5173/api/admin` (or `http://localhost:8000/admin`) and paste the token. It is kept in your browser tab only and sent as a header; it is never put in a URL. Without the token setting the three admin routes answer 404.

It shows today's calls, tokens, estimated cost, retries and failures, the budget bar when `NOVA_DAILY_TOKEN_BUDGET` is set, a table per kind of call (outline, lesson, quiz, answers, safety, tutor, ...), and a table per day with cache hits and turned-away requests.

Changing a plan in the chat before a course starts is one small call of kind `outline`, so it counts with the outline calls.

## Where the numbers are kept
Every model call adds to a counter for its day, model and kind: calls, prompt tokens, completion tokens, time and a latency bucket (up to 1 s, 3 s, 10 s, 30 s, slower), plus retries and failures. They live in the shared store (Upstash Redis when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, otherwise in memory and lost on restart) and are kept 90 days. No prompts, goals or user identifiers are stored in the counters.

## Logs
- Default: readable lines with a request id, for example `[8753aef37695] POST /api/courses/generate -> 200 (7674 ms) [calls=5 ...]`. The id is also returned in the `X-Request-ID` header and accepted from the caller.
- `LOG_FORMAT=json`: one JSON object per line with `time`, `level`, `logger`, `request_id`, `message` and, for requests that used the model, a `usage` object. Use this with a log service.
- `NOVA_LOG_PROMPTS=on`: also saves each prompt and reply (cut to 2,000 characters) to `backend/.data/prompts.jsonl`, tied to the request id. It keeps what learners typed, so it is for local debugging only and is ignored when `VERCEL` is set.
- `LOG_LEVEL=DEBUG` adds a line per model call with its tokens and time.

## Recent requests (built in, no outside service)

Every request that used the model leaves one record in NOVA's own store (Upstash Redis in production, memory locally): when it ran, route, status, seconds, the calls in order with their tokens and time, the cost, retries and failures, and remarks such as "question bank, attempt 1: 2 problem(s): evidence is not a quote". The newest 500 records of each day are kept for 7 days. They are listed under **Recent requests** on `/api/admin` and at `GET /api/admin/traces?limit=50&problems=true` (same token), where "problems" means a retry, a failure, a remark or an error status.

The text of the calls (prompts and replies, each cut to 2,000 characters) is saved only with `NOVA_TRACE_CONTENT=on`, because it holds what learners typed and uploaded. It stays in NOVA's own store and expires with the record. With it on, `python -m evals.from_traces` (run in `backend/`) turns requests that had problems into module eval cases in `evals/cases/from_traces.json` for you to review, so a failure seen in use is checked by every later eval.

A streamed course is saved when its stream ends, so its record has every call.

## Errors and alerts

Unhandled errors are kept in the same store as the request records (newest 200 a day, for 7 days) and listed under **Errors** on `/api/admin` and at `GET /api/admin/errors`: the error, the innermost few lines where it happened, and the request id to find the matching request. Errors the app answers on purpose (a refused goal, a busy model) are not errors; they show as problems in the request list.

When `NOVA_FAILURE_ALERT` model calls (20 by default, `0` switches it off) give up within one hour, one message goes to `NOVA_ALERT_WEBHOOK`.

To check the cost estimate against the Nebius invoice for a day, run `cd backend && python -m compare_invoice 2026-10-21 0.42` (the day in UTC, the invoice amount in dollars). It prints the ratio and the price settings that would match.

## Where learners get to

The app counts four steps: a course started, a topic finished for the first time, a module quiz passed for the first time, and a course finished. Each count is one call to `POST /api/events` with the name of the step only (no course, no text, nothing that identifies the learner), added to the day's totals. `/api/admin` shows them per day under **Where learners get to**, and `/api/admin/metrics` exports them as `nova_events_today{event="funnel:..."}`.

## Questions learners report

After answering, a learner can press **Report this question** and say what is wrong (the marked answer, unclear wording, wrong kind of question, off topic). The question's text and the reason are kept for 7 days (newest 500 a day) and listed under **Reported by learners** on `/api/admin`, and at `GET /api/admin/reports`. Nothing that says who reported it is kept, and reports are limited per address. A reported question is the best next eval case: add its topic to `backend/evals/cases/modules.json`.

## Warnings worth watching for
- `... is not an allowed model, using ... instead`: a setting asked for a model that is not one of the three vetted ones.
- `... failed for outline, trying ...`: the planning model was down or kept failing, so that call was asked of Lightning (the trace remark says the same).
- `Daily token budget is 80% used`: logged once (and posted to `NOVA_ALERT_WEBHOOK`, a Slack-style webhook, when set) when the day's tokens cross 80% of `NOVA_DAILY_TOKEN_BUDGET`; at 100% new work is refused with a 503 until the next UTC day.
- `Unusable model answer`: the model's JSON failed validation and was asked for again; a high count means a prompt or model problem (the eval suite measures it as the first-try rate).
