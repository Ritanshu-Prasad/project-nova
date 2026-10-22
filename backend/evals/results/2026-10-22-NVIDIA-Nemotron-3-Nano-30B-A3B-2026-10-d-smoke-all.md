# Evaluation 2026-10-22

Model `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, prompts `2026-10-d`, cases `smoke`, suites `all`, repeats 2

## Courses

| style | runs | ok | first_try | seconds | tokens | cost_usd | grade | duplicates | agreement | judge | questions_judge |
|---|---|---|---|---|---|---|---|---|---|---|---|
| overview | 4 | 1.0 | 0.985 | 39.475 | 17293 | 0.002 | 12.6 | 0.0 | 0.375 | 4.25 | 3.833 |
| practical | 4 | 1.0 | 1.0 | 30.175 | 14393.25 | 0.002 | 11.945 | 0.0 | 0.5 | 3.875 | 3.583 |
| deep | 4 | 0.75 | 0.858 | 52.925 | 19379.5 | 0.003 | 12.501 | 0.0 | 0.933 | 3.333 | 3.444 |

The deepest request gives a lesson this many times longer than the shortest: 1.115

| kind of call | p50 s | p95 s |
|---|---|---|
| answers | 1.75 | 2.43 |
| judge | 1.02 | 1.17 |
| lesson | 8.89 | 13.09 |
| outline | 1.56 | 6.03 |
| quiz | 4.45 | 23.22 |

- document `plants`: ok 1.0, modules 2, topics 5, seconds 35.7, tokens 54352, cost_usd 0.00674, retry_rate 0.0, citations 1.0, duplicates 0.0

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
- agreement: 0.6

## Modules

- runs: 6
- ok_rate: 1.0
- decision_accuracy: 1.0
- code_when_needed: 1.0
- no_code_when_not_needed: 1.0
- average_sections: 4.833333333333333

## Bank

- runs: 6
- ok_rate: 1.0
- clean_share: 0.9444444444444445
- first_try: 0.9761904761904763

## Cost

92 runs, 356 model calls, 438189 tokens, about $0.05634 in total ($0.000612 per run), estimated at the configured price.

