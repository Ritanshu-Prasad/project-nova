"""Scores what the course generator and tutor really write, so a change to a prompt can be shown to help or hurt.

It always uses the Nano model. Run from the backend folder:
    python -m evals.run_eval                                  # every suite, the smoke cases
    python -m evals.run_eval --suite goals --cases full --judge --repeat 3
    python -m evals.run_eval --baseline evals/baselines/nano.json --fail-on-regression
    python -m evals.run_eval --history
    python -m evals.run_eval --compare old.json new.json
"""
import argparse
import asyncio
import json
import os
import sys
from datetime import date
from pathlib import Path

import llm
from evals import bank_eval, cases, gate, goal_eval, injection_eval, module_eval, outline_eval, placement_eval, report, safety_eval, tutor_eval
from prompts import PROMPT_VERSION

HERE = Path(__file__).parent
SUITES = {"goals": None, "safety": safety_eval, "injection": injection_eval, "tutor": tutor_eval, "placement": placement_eval, "modules": module_eval, "bank": bank_eval, "outline": outline_eval}


async def run_suites(names: list[str], which: str, judge: bool, repeat: int) -> list[dict]:
    result_rows: list[dict] = []
    for name in names:
        result_rows += await goal_eval.run(which, judge, repeat) if name == "goals" else await SUITES[name].run(which)
    return result_rows


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--suite", choices=[*SUITES, "all"], default="all")
    parser.add_argument("--cases", choices=["smoke", "full"], default="smoke")
    parser.add_argument("--judge", action="store_true", help="also have the model review each lesson and its questions")
    parser.add_argument("--repeat", type=int, default=1, help="run each course case this many times to see how much results vary")
    parser.add_argument("--out", default=str(HERE / "results"))
    parser.add_argument("--baseline", help="a saved results file to compare with")
    parser.add_argument("--thresholds", default=str(HERE / "thresholds.json"))
    parser.add_argument("--fail-on-regression", action="store_true", help="exit with 1 when a threshold is broken")
    parser.add_argument("--history", action="store_true", help="list the saved runs and exit")
    parser.add_argument("--compare", nargs=2, metavar=("OLD", "NEW"))
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.history:
        print(report.history_table(Path(args.out)))
        return 0
    if args.compare:
        old, new = (json.loads(Path(path).read_text())["summary"] for path in args.compare)
        print(report.compare_summaries(old, new))
        return 0

    os.environ["NOVA_RATE_LIMIT"] = "off"
    os.environ["NOVA_MODERATION"] = "on"
    names = list(SUITES) if args.suite == "all" else [args.suite]
    styles = [style["id"] for style in cases.load("goals")["styles"]]
    result_rows = asyncio.run(run_suites(names, args.cases, args.judge, args.repeat))
    meta = {"date": date.today().isoformat(), "model": llm.generate_model(), "promptVersion": PROMPT_VERSION, "cases": args.cases, "suites": args.suite, "repeat": args.repeat}
    summary = report.build_summary(result_rows, styles)
    stem = f"{meta['date']}-{meta['model'].split('/')[-1]}-{PROMPT_VERSION}-{args.cases}-{meta['suites']}"
    Path(args.out).mkdir(parents=True, exist_ok=True)
    (Path(args.out) / f"{stem}.json").write_text(json.dumps({"meta": meta, "summary": summary, "rows": [_without_text(row) for row in result_rows]}, indent=2))
    text = report.render_markdown(summary, meta)
    (Path(args.out) / f"{stem}.md").write_text(text)
    print(text)
    return _gate(summary, args)


def _without_text(row: dict) -> dict:
    """Saved rows keep the numbers but not the long lesson text."""
    return {key: value for key, value in row.items() if key != "text"}


def _gate(summary: dict, args: argparse.Namespace) -> int:
    baseline = json.loads(Path(args.baseline).read_text())["summary"] if args.baseline else {}
    violations = gate.check(gate.flatten(summary), gate.flatten(baseline), gate.load_rules(Path(args.thresholds)))
    if not violations:
        print("Gate: every threshold holds." if args.baseline or args.fail_on_regression else "")
        return 0
    print("Gate: thresholds broken:\n" + "\n".join(f"- {violation.describe()}" for violation in violations))
    return 1 if args.fail_on_regression else 0


if __name__ == "__main__":
    sys.exit(main())
