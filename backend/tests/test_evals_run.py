import asyncio
import json

from fastapi import HTTPException

import generator
from course_models import Lesson
from evals import run_eval
from evals.run_eval import chosen, compare_summaries, lesson_text, render_markdown, run_document, run_goal, summarise
from samples import lesson_json

CASES = json.loads((run_eval.HERE / "cases.json").read_text())


def run(coro):
    return asyncio.run(coro)


# --- The cases ---

def test_the_smoke_set_is_smaller_than_the_full_set():
    smoke_goals, smoke_docs = chosen(CASES, "smoke")
    full_goals, full_docs = chosen(CASES, "full")
    assert 0 < len(smoke_goals) < len(full_goals) and smoke_docs and len(full_docs) >= len(smoke_docs)


def test_every_case_has_what_a_run_needs():
    assert all(case["id"] and case["goal"] for case in CASES["goals"])
    assert all(case["id"] and case["name"].endswith(".pdf") and case["pages"] for case in CASES["documents"])
    assert CASES["levels"] == ["beginner", "intermediate", "advanced"]


# --- One goal run ---

def test_a_goal_run_reports_quality_and_cost(fake_model):
    row = run(run_goal(CASES["goals"][0], "beginner", judge=False))
    assert row["ok"] and row["kind"] == "goal" and row["level"] == "beginner"
    assert row["questions"] == 20 and row["duplicates"] == 0.0 and row["agreement"] == 1.0 and row["grade"] > 0
    assert {"seconds", "calls", "tokens", "retries", "retry_rate", "mix"} <= set(row)


def test_a_goal_run_can_include_a_review(fake_model):
    row = run(run_goal(CASES["goals"][0], "advanced", judge=True))
    assert row["judge"] == 4.5 and row["judge_notes"] == "none"


def test_a_failing_run_is_reported_not_raised(fake_model):
    fake_model.replies = [HTTPException(503, "busy")]
    row = run(run_goal(CASES["goals"][0], "beginner", judge=False))
    assert row["ok"] is False and row["error"] == "busy"


# --- One document run ---

def test_a_document_run_builds_a_course_and_checks_its_quotes(fake_model):
    row = run(run_document(CASES["documents"][0], "intermediate"))
    assert row["ok"] and row["modules"] >= 1 and row["topics"] >= 1 and row["citations"] == 1.0


def test_a_document_run_restores_the_verifier(fake_model):
    original = generator.verify_sources
    run(run_document(CASES["documents"][0], "intermediate"))
    assert generator.verify_sources is original


def test_a_failing_document_run_is_reported_and_still_restores_the_verifier(fake_model):
    original = generator.verify_sources
    fake_model.replies = [HTTPException(503, "busy")] * 10
    row = run(run_document(CASES["documents"][0], "intermediate"))
    assert row["ok"] is False and generator.verify_sources is original


def test_the_lesson_text_gathers_the_prose_and_summary_points():
    text = lesson_text(Lesson.model_validate(lesson_json()))
    assert "A short version." in text and "Some body text." in text and "One point" in text


# --- Summaries ---

def goal_row(level, text, ok=True, **extra):
    return {"kind": "goal", "case": "docker", "level": level, "ok": ok, "text": text, "seconds": 10.0, "tokens": 5000, "retry_rate": 0.0, "grade": 8.0, "duplicates": 0.0, "agreement": 1.0, **extra}


LEVELS = ["beginner", "intermediate", "advanced"]


def rows():
    return [goal_row("beginner", "The cat sat. We like to play."), goal_row("intermediate", "mid"), goal_row("advanced", "Quantization-aware optimization necessitates comprehensive reconsideration of heterogeneous architectures.", judge=4.0)]


def test_the_summary_averages_each_level():
    summary = summarise(rows(), LEVELS)
    assert summary["levels"]["beginner"]["runs"] == 1 and summary["levels"]["beginner"]["tokens"] == 5000
    assert summary["levels"]["advanced"]["judge"] == 4.0 and summary["levels"]["beginner"]["judge"] is None


def test_failed_runs_lower_the_ok_rate_and_are_left_out_of_other_averages():
    summary = summarise([goal_row("beginner", "a"), goal_row("beginner", "b", ok=False, tokens=None)], LEVELS)
    assert summary["levels"]["beginner"]["ok"] == 0.5 and summary["levels"]["beginner"]["tokens"] == 5000


def test_the_level_gap_compares_the_easiest_and_hardest_texts():
    assert summarise(rows(), LEVELS)["level_gap"] > 5


def test_there_is_no_level_gap_without_both_ends():
    assert summarise(rows()[:2], LEVELS)["level_gap"] is None


def test_document_runs_are_listed_separately():
    document = {"kind": "document", "case": "plants", "ok": True, "modules": 2, "topics": 4, "seconds": 30.0, "tokens": 9000, "retry_rate": 0.0, "citations": 1.0, "duplicates": 0.0}
    assert summarise([document], LEVELS)["documents"][0]["citations"] == 1.0


def test_the_report_has_a_row_per_level_and_the_run_details():
    report = render_markdown(summarise(rows(), LEVELS), {"date": "2026-10-16", "model": "m", "promptVersion": "v1", "cases": "smoke"})
    assert "# Evaluation 2026-10-16" in report and "`m`" in report and "`v1`" in report
    assert all(f"| {level} |" in report for level in LEVELS) and "Grade gap" in report


def test_a_comparison_shows_the_change_in_each_metric():
    old, new = summarise(rows(), LEVELS), summarise([{**row, "tokens": 2500} for row in rows()], LEVELS)
    table = compare_summaries(old, new)
    assert "| beginner | tokens | 5000 | 2500 | -2500.000 |" in table


def test_a_comparison_skips_metrics_missing_on_one_side():
    old, new = summarise(rows(), LEVELS), summarise(rows(), LEVELS)
    assert "| beginner | judge |" not in compare_summaries(old, new)
