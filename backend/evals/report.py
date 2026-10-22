import json
import statistics
from fnmatch import fnmatch
from pathlib import Path

from evals import bank_eval, gate, injection_eval, module_eval, placement_eval, safety_eval, tutor_eval
from evals.metrics import length_ratio, percentile

GOAL_METRICS = ["ok", "first_try", "seconds", "tokens", "cost_usd", "grade", "duplicates", "agreement", "judge", "questions_judge"]
SPREAD_METRICS = ["seconds", "tokens", "grade", "judge"]
SECTIONS = {"safety": safety_eval, "injection": injection_eval, "tutor": tutor_eval, "placement": placement_eval, "modules": module_eval, "bank": bank_eval}


# --- Summaries ---

def summarise_goals(result_rows: list[dict], styles: list[str]) -> dict:
    """Averages per request style for goal runs, how much a deeper request lengthens the lesson, latency per kind of call, and document runs."""
    goal_rows = [row for row in result_rows if row["kind"] == "goal"]
    summary = {"styles": {}, "style_effect": _style_effect(goal_rows, styles), "documents": _documents(result_rows), "latency": _latency(goal_rows)}
    for style in styles:
        mine = [row for row in goal_rows if row["style"] == style]
        summary["styles"][style] = {
            "runs": len(mine),
            "ok": _average([1.0 if row["ok"] else 0.0 for row in mine]),
            **{name: _average([row[name] for row in mine if row.get(name) is not None]) for name in GOAL_METRICS[1:]},
            **{f"{name}_sd": _spread([row[name] for row in mine if row.get(name) is not None]) for name in SPREAD_METRICS},
        }
    return summary


def _style_effect(goal_rows: list[dict], styles: list[str]) -> float | None:
    """The deepest style's lesson as a multiple of the shortest style's, averaged over the goals; above one means the expectations are heard."""
    ratios = []
    for case in {row["case"] for row in goal_rows}:
        texts = {row["style"]: row["text"] for row in goal_rows if row["case"] == case and row["ok"]}
        if styles[0] in texts and styles[-1] in texts:
            ratios.append(length_ratio(texts[styles[0]], texts[styles[-1]]))
    return _average(ratios)


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


def build_summary(result_rows: list[dict], styles: list[str]) -> dict:
    """One summary with a section for every suite that produced rows."""
    suites = {name: [row for row in result_rows if row["suite"] == name] for name in ("goals", *SECTIONS)}
    summary = {}
    if suites["goals"]:
        summary["goals"] = summarise_goals(suites["goals"], styles)
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
    columns = ["ok", "first_try", "seconds", "tokens", "cost_usd", "grade", "duplicates", "agreement", "judge", "questions_judge"]
    lines = ["## Courses", "", "| style | runs | " + " | ".join(columns) + " |", "|---|---|" + "---|" * len(columns)]
    for style, values in goals["styles"].items():
        lines.append("| " + " | ".join([style, str(values["runs"])] + [_cell(values.get(name)) for name in columns]) + " |")
    lines += ["", f"The deepest request gives a lesson this many times longer than the shortest: {_cell(goals['style_effect'])}", ""]
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
        values = [pick("goals.styles.*.ok"), flat.get("cost.per_run_usd"), pick("goals.styles.*.judge"), flat.get("safety.recall"), flat.get("tutor.spoiler_rate"), flat.get("tutor.grounded_rate")]
        lines.append("| " + " | ".join([meta["date"], meta["model"].split("/")[-1], meta["promptVersion"], str(meta.get("suites", "goals"))] + [_cell(value) for value in values]) + " |")
    return "\n".join(lines) + "\n"
