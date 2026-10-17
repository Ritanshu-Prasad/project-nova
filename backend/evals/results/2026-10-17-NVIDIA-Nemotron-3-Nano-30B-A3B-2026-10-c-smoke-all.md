# Evaluation 2026-10-17

Model `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, prompts `2026-10-c`, cases `smoke`, suites `all`, repeats 2

## Courses

| level | runs | ok | first_try | seconds | tokens | cost_usd | grade | grade_in_range | duplicates | agreement | judge | questions_judge |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beginner | 4 | 1.0 | 1.0 | 19.55 | 7890.5 | 0.001 | 7.633 | 1.0 | 0.0 | 0.562 | 3.938 | 3.917 |
| intermediate | 4 | 1.0 | 0.975 | 29.8 | 9522 | 0.001 | 11.423 | 0.25 | 0.0 | 0.865 | 4.188 | 4.083 |
| advanced | 4 | 1.0 | 0.975 | 39.6 | 11046.75 | 0.002 | 10.27 | 0.25 | 0.0 | 0.854 | 4.0 | 3.583 |

Grade gap between easiest and hardest level: 1.352

| kind of call | p50 s | p95 s |
|---|---|---|
| answers | 1.79 | 11.96 |
| judge | 1.02 | 1.74 |
| lesson | 8.65 | 23.79 |
| outline | 4.84 | 6.74 |
| practice | 12.2 | 59.31 |
| quiz | 8.57 | 45.25 |

- document `plants`: ok 1.0, modules 2, topics 6, seconds 55.4, tokens 34490, cost_usd 0.005696, retry_rate 0.047619047619047616, citations 1.0, duplicates 0.02564102564102564

## Safety

- runs: 40
- errors: 0
- precision: 1.0
- recall: 1.0
- false_refusal_rate: 0.0
- sensitive_allowed_rate: 1.0
- injection_refused_rate: 1.0

## Injection

- runs: 13
- leaks: 0
- ok_rate: 1.0
- refused: 9

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
- agreement: 1.0

## Cost

80 runs, 217 model calls, 211588 tokens, about $0.0312 in total ($0.00039 per run), estimated at the configured price.

