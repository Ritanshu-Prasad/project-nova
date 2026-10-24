import asyncio

import course_models as course
from evals import cases, outline_eval, report
from evals.text_hygiene import hygiene_issues


def lesson(**changes) -> course.Lesson:
    data = {"minutes": 5, "objectives": ["Explain the idea clearly"], "simple": "A short version.", "blocks": [
        {"type": "text", "title": "Clarify your income", "body": "Plain text about money."},
        {"type": "text", "title": "Track your spending", "body": "More plain text."},
        {"type": "summary", "points": ["One point"]}]}
    return course.Lesson.model_validate({**data, **changes})


def mcq(q="Which one is right?", why="Because it follows from the idea.", options=("a", "b", "c", "d")) -> course.Mcq:
    return course.Mcq(type="mcq", q=q, why=why, options=list(options), answer=0)


def test_clean_text_has_no_issues():
    assert sum(hygiene_issues(lesson(), [mcq()]).values()) == 0


def test_each_slip_is_counted_in_its_own_place():
    slips = lesson(
        objectives=["Understand define short term goals"],
        blocks=[{"type": "text", "title": "1. Clarify", "body": "Short‑term goals"}, {"type": "text", "title": "1. clarify", "body": "x"}, {"type": "summary", "points": ["a"]}],
    )
    issues = hygiene_issues(slips, [mcq(q="Which one?", why="The module says so."), mcq(q="which one?", options=("a“b”", "b", "c", "d"))])
    assert issues == {"odd_typography": 2, "numbered_titles": 2, "understand_objectives": 1, "points_at_the_lesson": 1, "repeated_titles": 1, "repeated_questions": 1}


def test_ordinary_uses_of_the_word_text_or_a_normal_hyphen_are_fine():
    ok = lesson(blocks=[{"type": "text", "title": "Short-term plans", "body": "Edit the text of your plan."}, {"type": "summary", "points": ["a"]}])
    assert sum(hygiene_issues(ok, [mcq(why="The text field holds a short-term value.")]).values()) == 0


# --- Outline sizes ---

def run(coroutine):
    return asyncio.run(coroutine)


def test_an_outline_row_records_the_size_and_what_was_planned(fake_model):
    plan = cases.load("goals")
    row = run(outline_eval.check(plan["goals"][0], plan["styles"][0]))
    assert row["ok"] and (row["modules"], row["topics"]) == (2, 4) and (row["planned_modules"], row["planned_topics"]) == (2, 4)


def test_the_suite_runs_every_goal_in_every_style(fake_model):
    plan = cases.load("goals")
    rows = run(outline_eval.run("smoke"))
    assert len(rows) == len(cases.chosen(plan["goals"], "smoke")) * len(plan["styles"])


def row(case, style, topics, modules=3, planned=None, ok=True):
    return {"suite": "outline", "case": case, "style": style, "ok": ok, "modules": modules, "topics": topics, "planned_modules": planned or modules, "planned_topics": topics, "topic_overlap": None, "cost_usd": 0, "tokens": 0, "calls": 1}


def test_the_summary_averages_sizes_and_checks_that_a_deeper_request_is_not_smaller():
    rows = [row("a", "overview", 4), row("a", "deep", 12), row("b", "overview", 6), row("b", "deep", 5)]
    summary = outline_eval.summarise(rows)
    assert summary["styles"]["overview"]["topics"] == 5 and summary["styles"]["deep"]["topics"] == 8.5
    assert summary["size_follows_style"] == 0.5 and summary["ok_rate"] == 1.0


def test_a_plan_that_was_cut_is_counted_as_trimmed():
    assert outline_eval.summarise([row("a", "deep", 15, modules=6, planned=8), row("b", "deep", 6)])["trimmed"] == 0.5


def test_failed_plans_lower_the_ok_rate_and_are_left_out_of_sizes():
    summary = outline_eval.summarise([row("a", "overview", 4), {**row("a", "deep", 0), "ok": False}])
    assert summary["ok_rate"] == 0.5 and "deep" not in summary["styles"] and summary["size_follows_style"] is None


def test_the_report_has_an_outline_section_and_a_hygiene_column():
    text = report.render_markdown(report.build_summary([row("a", "overview", 4), row("a", "deep", 8)], ["overview"]), {"date": "2026-01-01", "model": "m", "promptVersion": "p", "cases": "smoke", "suites": "outline", "repeat": 1})
    assert "## Outline" in text and "size_follows_style: 1" in text
