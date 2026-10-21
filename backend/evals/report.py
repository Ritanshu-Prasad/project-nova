import json
import statistics
from fnmatch import fnmatch
from pathlib import Path

from evals import bank_eval, gate, injection_eval, module_eval, placement_eval, safety_eval, tutor_eval
from evals.metrics import fraction, level_gap, percentile

GOAL_METRICS = ["ok", "first_try", "seconds", "tokens", "cost_usd", "grade", "duplicates", "agreement", "judge", "questions_judge"]
SPREAD_METRICS = ["seconds", "tokens", "grade", "judge"]
SECTIONS = {"safety": safety_eval, "injection": injection_eval, "tutor": tutor_eval, "placement": placement_eval, "modules": module_eval, "bank": bank_eval}


# --- Summaries ---

def summarise_goals(result_rows: list[dict], levels: list[str]) -> dict:
    """Averages per level for goal runs, how far apart the levels read, latency per kind of call, and document runs."""
    goal_rows = [row for row in result_rows if row["kind"] == "goal"]
    summary = {"levels": {}, "level_gap": _level_gaps(goal_rows, levels), "documents": _documents(result_rows), "latency": _latency(goal_rows)}
    for level in levels:
        mine = [row for row in goal_rows if row["level"] == level]
        summary["levels"][level] = {
            "runs": len(mine),
            "ok": _average([1.0 if row["ok"] else 0.0 for row in mine]),
            **{name: _average([row[name] for row in mine if row.get(name) is not None]) for name in GOAL_METRICS[1:]},
            "grade_in_range": fraction([row for row in mine if row["ok"]], lambda row: row["grade_ok"]),
            **{f"{name}_sd": _spread([row[name] for row in mine if row.get(name) is not None]) for name in SPREAD_METRICS},
        }
    return summary


def _level_gaps(goal_rows: list[dict], levels: list[str]) -> float | None:
    gaps = []
    for case in {row["case"] for row in goal_rows}:
        texts = {row["level"]: row["text"] for row in goal_rows if row["case"] == case and row["ok"]}
        if levels[0] in texts and levels[-1] in texts:
            gaps.append(level_gap(texts[levels[0]], texts[levels[-1]]))
    return _average(gaps)


def _documents(result_rows: list[dict]) -> dict:
    keys = ("ok", "modules", "topics", "seconds", "tokens", "cost_usd", "retry_rate", "citations", "duplicates")
    return {row["case"]: {key: (1.0 if row.get(key) is True else 0.0 if row.get(key) is False else row.get(key)) for key in keys} for row in result_rows if row["kind"] == "document"}


def _latency(goal_rows: list[dict]) -> dict:
    by_kind: dict[str, list[float]] = {}
    for row in goal_rows:
        for kind, seconds in row.get("kind_seconds", {}).items():
            by_kind.setdefault(kind, []).extend(seconds)
    return {kind: {"p50": percentile(values, 50), "p95": percentile(values, 95)} for kind, values in sorted(by_kind.items())}


def _average(values: list[float]) -> float | None:
    return round(statistics.mean(values), 3) if values else None


def _spread(values: list[float]) -> float | None:
    return round(statistics.stdev(values), 3) if len(values) > 1 else None


def summarise_cost(result_rows: list[dict]) -> dict:
    total = sum(row["cost_usd"] for row in result_rows)
    return {
        "total_usd": round(total, 5),
        "per_run_usd": round(total / len(result_rows), 6) if result_rows else None,
        "tokens": sum(row["tokens"] for row in result_rows),
        "calls": sum(row["calls"] for row in result_rows),
        "runs": len(result_rows),
    }


def build_summary(result_rows: list[dict], levels: list[str]) -> dict:
    """One summary with a section for every suite that produced rows."""
    suites = {name: [row for row in result_rows if row["suite"] == name] for name in ("goals", *SECTIONS)}
    summary = {}
    if suites["goals"]:
        summary["goals"] = summarise_goals(suites["goals"], levels)
    for name, module in SECTIONS.items():
        if suites[name]:
            summary[name] = module.summarise(suites[name])
    summary["cost"] = summarise_cost(result_rows)
    return summary


# --- Showing them ---

def render_markdown(summary: dict, meta: dict) -> str:
    lines = [f"# Evaluation {meta['date']}", "", f"Model `{meta['model']}`, prompts `{meta['promptVersion']}`, cases `{meta['cases']}`, suites `{meta['suites']}`, repeats {meta['repeat']}", ""]
    if "goals" in summary:
        lines += _goal_table(summary["goals"])
    for name in SECTIONS:
        if name in summary:
            lines += [f"## {name.capitalize()}", ""] + [f"- {metric}: {_cell(value)}" for metric, value in summary[name].items()] + [""]
    cost = summary["cost"]
    lines += ["## Cost", "", f"{cost['runs']} runs, {cost['calls']} model calls, {cost['tokens']} tokens, about ${cost['total_usd']} in total (${_cell(cost['per_run_usd'])} per run), estimated at the configured price.", ""]
    return "\n".join(lines) + "\n"


def _goal_table(goals: dict) -> list[str]:
    columns = ["ok", "first_try", "seconds", "tokens", "cost_usd", "grade", "grade_in_range", "duplicates", "agreement", "judge", "questions_judge"]
    lines = ["## Courses", "", "| level | runs | " + " | ".join(columns) + " |", "|---|---|" + "---|" * len(columns)]
    for level, values in goals["levels"].items():
        lines.append("| " + " | ".join([level, str(values["runs"])] + [_cell(values.get(name)) for name in columns]) + " |")
    lines += ["", f"Grade gap between easiest and hardest level: {_cell(goals['level_gap'])}", ""]
    if goals["latency"]:
        lines += ["| kind of call | p50 s | p95 s |", "|---|---|---|"] + [f"| {kind} | {_cell(values['p50'])} | {_cell(values['p95'])} |" for kind, values in goals["latency"].items()] + [""]
    lines += [f"- document `{case}`: " + ", ".join(f"{key} {_cell(value)}" for key, value in document.items()) for case, document in goals["documents"].items()]
    return lines + [""]


def _cell(value) -> str:
    return "-" if value is None else str(value)


def compare_summaries(old: dict, new: dict) -> str:
    """The change in every number the two summaries share."""
    before, after = gate.flatten(old), gate.flatten(new)
    lines = ["| metric | before | after | change |", "|---|---|---|---|"]
    for name in sorted(set(before) & set(after)):
        if ".latency." in name or name.endswith(("_sd", ".runs")):
            continue
        lines.append(f"| {name} | {before[name]} | {after[name]} | {after[name] - before[name]:+.3f} |")
    return "\n".join(lines) + "\n"


def history_table(results: Path) -> str:
    """One line per saved run, oldest first, with the numbers that matter."""
    lines = ["| date | model | prompts | suites | ok | cost per run | judge | safety recall | spoiler rate | grounded |", "|---|---|---|---|---|---|---|---|---|---|"]
    for path in sorted(results.glob("*.json")):
        data = json.loads(path.read_text())
        meta, flat = data["meta"], gate.flatten(data["summary"])
        pick = lambda pattern: _average([value for name, value in flat.items() if fnmatch(name, pattern)])
        values = [pick("goals.levels.*.ok"), flat.get("cost.per_run_usd"), pick("goals.levels.*.judge"), flat.get("safety.recall"), flat.get("tutor.spoiler_rate"), flat.get("tutor.grounded_rate")]
        lines.append("| " + " | ".join([meta["date"], meta["model"].split("/")[-1], meta["promptVersion"], str(meta.get("suites", "goals"))] + [_cell(value) for value in values]) + " |")
    return "\n".join(lines) + "\n"
