# Evaluation 2026-10-22

Model `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, prompts `2026-10-d`, cases `smoke`, suites `all`, repeats 2

## Courses

| style | runs | ok | first_try | seconds | tokens | cost_usd | grade | duplicates | agreement | hygiene | judge | questions_judge |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| overview | 4 | 1.0 | 0.969 | 47.275 | 17403.25 | 0.002 | 11.607 | 0.0 | 0.838 | 0 | 4.0 | 3.25 |
| practical | 4 | 1.0 | 1.0 | 33.675 | 14850.5 | 0.002 | 12.444 | 0.0 | 0.5 | 0 | 4.0 | 3.75 |
| deep | 4 | 1.0 | 0.981 | 46.9 | 19172.75 | 0.002 | 22.621 | 0.0 | 0.729 | 0 | 3.688 | 3.417 |

The deepest request gives a lesson this many times longer than the shortest: 1.092

| kind of call | p50 s | p95 s |
|---|---|---|
| answers | 2.03 | 2.38 |
| judge | 1.08 | 1.32 |
| lesson | 8.6 | 13.44 |
| outline | 1.47 | 7.39 |
| quiz | 4.84 | 26.68 |

- document `plants`: ok 1.0, modules 2, topics 6, seconds 39.9, tokens 71264, cost_usd 0.008297, retry_rate 0.0, citations 1.0, duplicates 0.0

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
- average_sections: 5.333333333333333

## Bank

- runs: 6
- ok_rate: 1.0
- clean_share: 0.7685185185185186
- first_try: 0.9606481481481483

## Outline

- runs: 6
- ok_rate: 1.0
- styles: {'overview': {'modules': 4.0, 'topics': 12.0}, 'practical': {'modules': 4.0, 'topics': 12.0}, 'deep': {'modules': 4.5, 'topics': 13.5}}
- size_follows_style: 1.0
- trimmed: 0.0

## Cost

98 runs, 389 model calls, 490702 tokens, about $0.0588 in total ($0.0006 per run), estimated at the configured price.

