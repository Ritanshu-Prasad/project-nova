# Evaluation 2026-10-24

Model `nvidia/Nemotron-3_5-Lightning`, prompts `2026-10-e`, cases `smoke`, suites `all`, repeats 1

## Courses

| style | runs | ok | first_try | seconds | tokens | cost_usd | grade | duplicates | agreement | hygiene | judge | questions_judge |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| overview | 2 | 1.0 | 1.0 | 32.85 | 16472.5 | 0.002 | 10.49 | 0.0 | 0.625 | 0 | 5.0 | 3.833 |
| practical | 2 | 1.0 | 1.0 | 32.75 | 22782.5 | 0.002 | 10.807 | 0.0 | 0.9 | 0 | 4.375 | 2.833 |
| deep | 2 | 1.0 | 0.967 | 59.6 | 35223.5 | 0.004 | 13.321 | 0.0 | 0.875 | 0 | 5.0 | 2.333 |

The deepest request gives a lesson this many times longer than the shortest: 1.664

| kind of call | p50 s | p95 s |
|---|---|---|
| answers | 1.46 | 2.34 |
| judge | 0.87 | 1.41 |
| lesson | 1.49 | 22.23 |
| outline | 3.08 | 3.76 |
| quiz | 4.85 | 14.55 |

- document `plants`: ok 1.0, modules 2, topics 6, seconds 49.9, tokens 101558, cost_usd 0.010855, retry_rate 0.0, citations 1.0, duplicates 0.0

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

## Modules

- runs: 6
- ok_rate: 1.0
- decision_accuracy: 1.0
- code_when_needed: 1.0
- no_code_when_not_needed: 1.0
- average_sections: 5.166666666666667

## Bank

- runs: 6
- ok_rate: 1.0
- clean_share: 0.8240740740740741
- first_try: 0.9861111111111112

## Outline

- runs: 6
- ok_rate: 1.0
- styles: {'overview': {'modules': 2.5, 'topics': 7.5}, 'practical': {'modules': 3.5, 'topics': 10.5}, 'deep': {'modules': 4.5, 'topics': 13.5}}
- size_follows_style: 1.0
- trimmed: 0.0

## Cost

92 runs, 347 model calls, 520692 tokens, about $0.05735 in total ($0.000623 per run), estimated at the configured price.

