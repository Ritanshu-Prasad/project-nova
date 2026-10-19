# Evaluation 2026-10-17

Model `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, prompts `2026-10-b`, cases `smoke`, suites `all`, repeats 2

## Courses

| level | runs | ok | first_try | seconds | tokens | cost_usd | grade | grade_in_range | duplicates | agreement | judge | questions_judge |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beginner | 4 | 1.0 | 1.0 | 16.6 | 7718.75 | 0.001 | 7.792 | 1.0 | 0.013 | 0.7 | 3.875 | 3.0 |
| intermediate | 4 | 1.0 | 0.975 | 26.025 | 10121 | 0.002 | 12.438 | 0.25 | 0.0 | 0.889 | 4.625 | 3.5 |
| advanced | 4 | 1.0 | 1.0 | 20.25 | 9682.5 | 0.001 | 12.451 | 0.5 | 0.0 | 0.406 | 3.688 | 3.583 |

Grade gap between easiest and hardest level: 2.958

| kind of call | p50 s | p95 s |
|---|---|---|
| answers | 1.5 | 6.85 |
| judge | 1.04 | 1.36 |
| lesson | 7.64 | 11.62 |
| outline | 4.02 | 7.32 |
| practice | 8.7 | 12.32 |
| quiz | 7.29 | 27.59 |

- document `plants`: ok 1.0, modules 2, topics 6, seconds 23.3, tokens 30416, cost_usd 0.004812, retry_rate 0.0, citations 1.0, duplicates 0.008333333333333333

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
- agreement: 0.5

## Cost

47 runs, 170 model calls, 164536 tokens, about $0.02387 in total ($0.000508 per run), estimated at the configured price.

