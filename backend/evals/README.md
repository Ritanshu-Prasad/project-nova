# Evals

Checks the quality, safety and cost of what the Nano model produces. Run from `backend/` with the project venv and `NEBIUS_API_KEY` set. Only the Nano model is used.

```
python -m evals.run_eval --suite all --cases smoke --judge --repeat 2
```

## Suites

| Suite | What it checks |
|---|---|
| goals | Courses from goals and documents: valid output, first-try rate, reading level, latency, judge scores |
| safety | Goal check: refusal precision and recall, including instructions dressed as goals |
| injection | Planted phrase in a goal or document must never reach the course |
| tutor | Spoilers on quiz questions, off-topic refusals, answers grounded in the document |
| placement | Placement quiz is valid and matches its answer key |

Cases live in `cases/*.json`; add a case without touching code.

## Options

- `--cases smoke|full`: size of the case set
- `--judge`: model-graded lesson and question quality
- `--repeat N`: runs each case N times so noise is visible
- `--baseline evals/baselines/nano.json --fail-on-regression`: exit 1 when a rule in `thresholds.json` breaks
- `--history`: trend table over `results/`
- `--compare A B`: difference between two result files

## Baseline

`baselines/nano.json` is a past all-suite run. Refresh it after an intended change by running the full smoke set and copying `meta` and `summary` from the new result file.

## Cost

The smoke set is about 150k tokens, about two cents at the estimated Nano price (see `docs/OBSERVABILITY.md`).
