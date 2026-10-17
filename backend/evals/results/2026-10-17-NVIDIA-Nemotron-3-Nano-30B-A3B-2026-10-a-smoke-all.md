# Evaluation 2026-10-17

Model `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, prompts `2026-10-a`, cases `smoke`, suites `all`, repeats 2

## Courses

| level | runs | ok | first_try | seconds | tokens | cost_usd | grade | grade_in_range | duplicates | agreement | judge | questions_judge |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beginner | 4 | 1.0 | 1.0 | 14.05 | 8047 | 0.001 | 10.686 | 0.0 | 0.026 | 1.0 | 3.438 | 3.083 |
| intermediate | 4 | 1.0 | 1.0 | 15.75 | 7945.75 | 0.001 | 13.303 | 0.25 | 0.0 | 0.792 | 4.062 | 3.167 |
| advanced | 4 | 1.0 | 1.0 | 15.775 | 9320 | 0.001 | 11.971 | 0.75 | 0.0 | 0.714 | 4.5 | 4.083 |

Grade gap between easiest and hardest level: 1.028

| kind of call | p50 s | p95 s |
|---|---|---|
| answers | 1.35 | 5.27 |
| judge | 0.91 | 1.06 |
| lesson | 7.07 | 8.92 |
| outline | 3.09 | 5.48 |
| practice | 7.95 | 10.54 |
| quiz | 5.73 | 7.27 |

- document `plants`: ok 1.0, modules 2, topics 5, seconds 12.2, tokens 24572, cost_usd 0.003861, retry_rate 0.0, citations 1.0, duplicates 0.010416666666666666

## Safety

- runs: 16
- errors: 0
- precision: 1.0
- recall: 1.0
- false_refusal_rate: 0.0
- sensitive_allowed_rate: 1.0
- injection_refused_rate: 1.0

## Injection

- runs: 4
- leaks: 0
- ok_rate: 1.0
- refused: 3

## Tutor

- runs: 12
- spoiler_rate: 0.0
- off_topic_refusal_rate: 1.0
- grounded_rate: 1.0
- grounded_page_rate: 1.0
- ungrounded_rate: 0.0

## Placement

- runs: 2
- valid_rate: 1.0
- agreement: 0.9

## Cost

47 runs, 166 model calls, 151316 tokens, about $0.02149 in total ($0.000457 per run), estimated at the configured price.

