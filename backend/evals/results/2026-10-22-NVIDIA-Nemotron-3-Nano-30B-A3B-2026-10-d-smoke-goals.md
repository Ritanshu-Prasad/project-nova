# Evaluation 2026-10-22

Model `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, prompts `2026-10-d`, cases `smoke`, suites `goals`, repeats 2

## Courses

| style | runs | ok | first_try | seconds | tokens | cost_usd | grade | duplicates | agreement | judge | questions_judge |
|---|---|---|---|---|---|---|---|---|---|---|---|
| overview | 4 | 0.75 | 0.86 | 52.6 | 15194.5 | 0.002 | 10.87 | 0.0 | 1.0 | 3.083 | 4.0 |
| practical | 4 | 1.0 | 1.0 | 43.45 | 12435 | 0.002 | 12.035 | 0.0 | 0.729 | 4.188 | 3.083 |
| deep | 4 | 1.0 | 1.0 | 46.325 | 14073.25 | 0.002 | 12.014 | 0.0 | 0.75 | 3.75 | 4.75 |

The deepest request gives a lesson this many times longer than the shortest: 1.3

| kind of call | p50 s | p95 s |
|---|---|---|
| answers | 1.95 | 4.23 |
| judge | 1.15 | 1.33 |
| lesson | 9.63 | 34.57 |
| outline | 2.27 | 8.38 |
| quiz | 5.93 | 23.85 |

- document `plants`: ok 1.0, modules 2, topics 6, seconds 101.8, tokens 62116, cost_usd 0.00833, retry_rate 0.07894736842105263, citations 1.0, duplicates 0.0

## Cost

13 runs, 175 model calls, 228927 tokens, about $0.02919 in total ($0.002245 per run), estimated at the configured price.

