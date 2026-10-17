"""Scores what the course generator writes, so a change to a prompt or a model can be shown to help or hurt.

Run from the backend folder:
    python -m evals.run_eval --cases smoke            # a few goals and one document
    python -m evals.run_eval --cases full --judge     # every goal, with a model-written review
    python -m evals.run_eval --compare old.json new.json
"""
import argparse
import asyncio
import io
import json
import statistics
import time
from datetime import date
from pathlib import Path

from fastapi import HTTPException, UploadFile

import generator
import llm
import usage
from answer_check import agreement
from course_models import Lesson
from course_requests import CourseRequest
from evals.judge import judge_lesson
from evals.metrics import citation_survival, duplicate_rate, level_gap, reading_grade, retry_rate, type_mix
from evals.pdfs import make_pdf
from pdf_parser import read_documents
from planning import fit_outline, plan_outline
from progress import ignore
from prompts import PROMPT_VERSION
from writing import write_topic

HERE = Path(__file__).parent
PARALLEL_CASES = 3
METRICS = ["ok", "seconds", "tokens", "retry_rate", "grade", "duplicates", "agreement", "judge"]


# --- One run ---

async def run_goal(case: dict, level: str, judge: bool) -> dict:
    """Plans a course for the goal and writes its first topic at one level."""
    usage.begin()
    request = CourseRequest(mode="goal", level=level, objective=case["goal"])
    row = {"kind": "goal", "case": case["id"], "level": level}
    started = time.perf_counter()
    try:
        outline = fit_outline(await plan_outline(request))
        module, topic = outline.modules[0], outline.modules[0].topics[0]
        titles = [t.title for m in outline.modules for t in m.topics]
        content = await write_topic(module.title, topic, request, "", titles, "")
        text = lesson_text(content.lesson)
        questions = content.quiz + content.practice
        row.update(ok=True, text=text, grade=reading_grade(text), duplicates=duplicate_rate(questions), mix=type_mix(questions), questions=len(questions))
        row["agreement"] = await agreement(content.quiz, level)
        if judge:
            scores = await judge_lesson(case["goal"], level, content.lesson.objectives, text)
            row["judge"] = scores.average
            row["judge_notes"] = scores.notes
    except HTTPException as error:
        row.update(ok=False, error=str(error.detail))
    return _with_cost(row, started)


async def run_document(case: dict, level: str) -> dict:
    """Builds a whole course from a small document and checks how many quotes were really in it."""
    usage.begin()
    request = CourseRequest(mode="documents", level=level)
    row = {"kind": "document", "case": case["id"], "level": level}
    started = time.perf_counter()
    quotes = {"before": 0, "after": 0}
    real_verify = generator.verify_sources

    def counting(contents, documents):
        quotes["before"] = sum(1 for module in contents for c in module for b in c.lesson.blocks if b.type == "source")
        checked = real_verify(contents, documents)
        quotes["after"] = sum(1 for module in checked for c in module for b in c.lesson.blocks if b.type == "source")
        return checked

    generator.verify_sources = counting
    try:
        upload = UploadFile(file=io.BytesIO(make_pdf(case["pages"])), filename=case["name"])
        course = await generator._course_from_documents(request, await read_documents([upload]), ignore)
        topics = [t for m in course.modules for t in m.topics]
        text = " ".join(lesson_text(t.lesson) for t in topics)
        questions = [q for t in topics for q in t.quiz + t.practice]
        row.update(ok=True, modules=len(course.modules), topics=len(topics), grade=reading_grade(text), duplicates=duplicate_rate(questions), mix=type_mix(questions), citations=citation_survival(quotes["before"], quotes["after"]))
    except HTTPException as error:
        row.update(ok=False, error=str(error.detail))
    finally:
        generator.verify_sources = real_verify
    return _with_cost(row, started)


def lesson_text(lesson: Lesson) -> str:
    parts = [lesson.simple]
    for block in lesson.blocks:
        parts += [getattr(block, "body", "")] + list(getattr(block, "points", []))
    return " ".join(part for part in parts if part)


def _with_cost(row: dict, started: float) -> dict:
    spent = usage.current()
    row.update(seconds=round(time.perf_counter() - started, 1), calls=spent.calls, tokens=spent.tokens, retries=spent.retries, retry_rate=retry_rate(spent.calls, spent.retries))
    return row


# --- Many runs ---

def chosen(cases: dict, which: str) -> tuple[list, list]:
    keep = (lambda case: case.get("smoke")) if which == "smoke" else (lambda case: True)
    return [case for case in cases["goals"] if keep(case)], [case for case in cases["documents"] if keep(case)]


async def run_all(cases: dict, which: str, judge: bool) -> list[dict]:
    goals, documents = chosen(cases, which)
    gate = asyncio.Semaphore(PARALLEL_CASES)

    async def limited(coroutine):
        async with gate:
            return await coroutine

    jobs = [limited(run_goal(case, level, judge)) for case in goals for level in cases["levels"]]
    jobs += [limited(run_document(case, "intermediate")) for case in documents]
    return list(await asyncio.gather(*jobs))


# --- Reading the results ---

def summarise(rows: list[dict], levels: list[str]) -> dict:
    """Averages per level for goal runs, plus how far apart the levels read."""
    summary = {"levels": {}, "level_gap": _level_gaps(rows, levels), "documents": _documents(rows)}
    for level in levels:
        mine = [row for row in rows if row["kind"] == "goal" and row["level"] == level]
        summary["levels"][level] = {
            "runs": len(mine),
            "ok": _average([1.0 if row["ok"] else 0.0 for row in mine]),
            **{name: _average([row[name] for row in mine if row.get(name) is not None]) for name in METRICS[1:]},
        }
    return summary


def _level_gaps(rows: list[dict], levels: list[str]) -> float | None:
    gaps = []
    for case in {row["case"] for row in rows if row["kind"] == "goal"}:
        texts = {row["level"]: row["text"] for row in rows if row["case"] == case and row["ok"]}
        if levels[0] in texts and levels[-1] in texts:
            gaps.append(level_gap(texts[levels[0]], texts[levels[-1]]))
    return _average(gaps)


def _documents(rows: list[dict]) -> list[dict]:
    return [{key: row.get(key) for key in ("case", "ok", "modules", "topics", "seconds", "tokens", "retry_rate", "citations", "duplicates")} for row in rows if row["kind"] == "document"]


def _average(values: list[float]) -> float | None:
    return round(statistics.mean(values), 3) if values else None


def render_markdown(summary: dict, meta: dict) -> str:
    lines = [f"# Evaluation {meta['date']}", "", f"Model `{meta['model']}`, prompts `{meta['promptVersion']}`, cases `{meta['cases']}`", ""]
    lines += ["| level | runs | ok | seconds | tokens | retry rate | grade | duplicates | agreement | judge |", "|---|---|---|---|---|---|---|---|---|---|"]
    for level, values in summary["levels"].items():
        lines.append("| " + " | ".join([level, str(values["runs"])] + [_cell(values[name]) for name in METRICS]) + " |")
    lines += ["", f"Grade gap between easiest and hardest level: {_cell(summary['level_gap'])}", ""]
    for document in summary["documents"]:
        lines.append(f"- document `{document['case']}`: " + ", ".join(f"{key} {_cell(value)}" for key, value in document.items() if key != "case"))
    return "\n".join(lines) + "\n"


def _cell(value) -> str:
    return "-" if value is None else str(value)


def compare_summaries(old: dict, new: dict) -> str:
    """The change in every per-level average from one result file to the next."""
    lines = ["| level | metric | before | after | change |", "|---|---|---|---|---|"]
    for level, values in new["levels"].items():
        for name in METRICS:
            before, after = old["levels"].get(level, {}).get(name), values.get(name)
            if before is not None and after is not None:
                lines.append(f"| {level} | {name} | {before} | {after} | {after - before:+.3f} |")
    return "\n".join(lines) + "\n"


# --- Command line ---

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cases", choices=["smoke", "full"], default="smoke")
    parser.add_argument("--judge", action="store_true", help="also have the model review each lesson")
    parser.add_argument("--out", default=str(HERE / "results"))
    parser.add_argument("--compare", nargs=2, metavar=("OLD", "NEW"))
    args = parser.parse_args()

    if args.compare:
        old, new = (json.loads(Path(path).read_text())["summary"] for path in args.compare)
        print(compare_summaries(old, new))
        return
    cases = json.loads((HERE / "cases.json").read_text())
    rows = asyncio.run(run_all(cases, args.cases, args.judge))
    meta = {"date": date.today().isoformat(), "model": llm.generate_model(), "promptVersion": PROMPT_VERSION, "cases": args.cases}
    summary = summarise(rows, cases["levels"])
    stem = f"{meta['date']}-{meta['model'].split('/')[-1]}-{PROMPT_VERSION}-{args.cases}"
    Path(args.out).mkdir(parents=True, exist_ok=True)
    (Path(args.out) / f"{stem}.json").write_text(json.dumps({"meta": meta, "summary": summary, "rows": rows}, indent=2))
    report = render_markdown(summary, meta)
    (Path(args.out) / f"{stem}.md").write_text(report)
    print(report)


if __name__ == "__main__":
    main()
