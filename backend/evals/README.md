# Evals

Checks the quality, safety and cost of what the course and tutor models produce. Run from `backend/` with the project venv and `NEBIUS_API_KEY` set. It uses the models the settings name (by default Nemotron 3.5 Lightning, with DeepSeek-V4-Flash-0731 planning the courses); the result file names the content model and, when different, the planning model.

```
python -m evals.run_eval --suite all --cases smoke --judge --repeat 2
```

## Suites

| Suite | What it checks |
|---|---|
| goals | Courses from goals and documents, written for three kinds of expectation (overview, practical, deep): valid output, first-try rate, how much longer a deep lesson is, text hygiene (odd typography, numbered titles, "Understand" objectives, "the module" in questions, repeats; must be 0), latency, judge scores |
| safety | Goal check: refusal precision and recall, including instructions dressed as goals |
| injection | Planted phrase in a goal or document must never reach the course |
| tutor | Spoilers on quiz questions, off-topic refusals, answers grounded in the document |
| placement | Placement quiz is valid and matches its answer key |
| modules | Module writer: decides code vs no code correctly, writes code only when needed, writes a valid module |
| outline | The planned size of a course for each kind of expectation: modules and topics per style, whether an overview plan is no bigger than a deep one, how often the plan was trimmed |
| bank | Question bank: first-try wording-vs-type consistency and quoted evidence, and whether a reliable bank is produced |

Cases live in `cases/*.json`; add a case without touching code.

## Options

- `--cases smoke|full`: size of the case set
- `--judge`: model-graded lesson and question quality
- `--repeat N`: runs each case N times so noise is visible
- `--baseline evals/baselines/lightning.json --fail-on-regression`: exit 1 when a rule in `thresholds.json` breaks
- `--history`: trend table over `results/`
- `--compare A B`: difference between two result files

## Baseline

`baselines/lightning.json` is the all-suite run of the Lightning + DeepSeek setup (`baselines/nano.json` is the older Nano one). Refresh it after an intended change by running the full smoke set and copying `meta` and `summary` from the new result file.

## Cost

The smoke set is about 150k tokens, about two cents at the estimated price (see `docs/OBSERVABILITY.md`).
