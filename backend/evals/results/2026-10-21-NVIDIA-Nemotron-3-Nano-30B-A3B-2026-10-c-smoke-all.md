# Evaluation 2026-10-21

Model `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, prompts `2026-10-c`, cases `smoke`, suites `all`, repeats 2

## Courses

| level | runs | ok | first_try | seconds | tokens | cost_usd | grade | grade_in_range | duplicates | agreement | judge | questions_judge |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beginner | 4 | 1.0 | 1.0 | 14.0 | 7229.5 | 0.001 | 8.022 | 0.75 | 0.013 | 1.0 | 3.875 | 4.0 |
| intermediate | 4 | 1.0 | 1.0 | 14.2 | 8490.25 | 0.001 | 12.836 | 0.25 | 0.0 | 0.85 | 3.938 | 3.667 |
| advanced | 4 | 1.0 | 0.95 | 32.65 | 11189.25 | 0.002 | 13.255 | 0.5 | 0.0 | 0.312 | 3.688 | 3.083 |

Grade gap between easiest and hardest level: 4.983

| kind of call | p50 s | p95 s |
|---|---|---|
| answers | 1.33 | 6.13 |
| judge | 0.9 | 1.12 |
| lesson | 6.42 | 10.19 |
| outline | 3.47 | 5.18 |
| practice | 7.69 | 38.64 |
| quiz | 5.5 | 25.67 |

- document `plants`: ok 1.0, modules 2, topics 6, seconds 33.3, tokens 35782, cost_usd 0.006051, retry_rate 0.047619047619047616, citations 1.0, duplicates 0.0

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
- agreement: 0.9

## Modules

- runs: 6
- ok_rate: 1.0
- decision_accuracy: 1.0
- code_when_needed: 1.0
- no_code_when_not_needed: 1.0
- average_sections: 4.5

## Bank

- runs: 6
- ok_rate: 1.0
- clean_share: 1.0
- first_try: 0.9722222222222223

## Cost

92 runs, 268 model calls, 263723 tokens, about $0.039 in total ($0.000424 per run), estimated at the configured price.

