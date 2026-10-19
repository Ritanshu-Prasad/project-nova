import json

from evals import report
from evals.report import build_summary, compare_summaries, history_table, render_markdown, summarise_cost, summarise_goals

LEVELS = ["beginner", "intermediate", "advanced"]
META = {"date": "2026-10-17", "model": "nvidia/m", "promptVersion": "v1", "cases": "smoke", "suites": "goals", "repeat": 1}


def goal_row(level, text, ok=True, **extra):
    return {"suite": "goals", "kind": "goal", "case": "docker", "level": level, "ok": ok, "text": text, "seconds": 10.0, "tokens": 5000, "cost_usd": 0.001, "retry_rate": 0.0, "first_try": 1.0,
            "grade": 8.0, "grade_ok": True, "duplicates": 0.0, "agreement": 1.0, "calls": 5, "kind_seconds": {"lesson": [4.0], "quiz": [3.0]}, **extra}


def goal_rows():
    return [goal_row("beginner", "The cat sat. We like to play."), goal_row("intermediate", "mid"), goal_row("advanced", "Quantization-aware optimization necessitates comprehensive reconsideration of heterogeneous architectures.", judge=4.0)]


# --- Goals ---

def test_the_summary_averages_each_level():
    summary = summarise_goals(goal_rows(), LEVELS)
    assert summary["levels"]["beginner"]["runs"] == 1 and summary["levels"]["beginner"]["tokens"] == 5000
    assert summary["levels"]["advanced"]["judge"] == 4.0 and summary["levels"]["beginner"]["judge"] is None


def test_failed_runs_lower_the_ok_rate_and_are_left_out_of_other_averages():
    summary = summarise_goals([goal_row("beginner", "a"), goal_row("beginner", "b", ok=False, tokens=None)], LEVELS)
    assert summary["levels"]["beginner"]["ok"] == 0.5 and summary["levels"]["beginner"]["tokens"] == 5000


def test_the_level_gap_compares_the_easiest_and_hardest_texts():
    assert summarise_goals(goal_rows(), LEVELS)["level_gap"] > 5
    assert summarise_goals(goal_rows()[:2], LEVELS)["level_gap"] is None


def test_the_share_of_lessons_at_a_fitting_reading_grade_is_reported():
    rows = [goal_row("beginner", "a", grade_ok=True), goal_row("beginner", "b", grade_ok=False)]
    assert summarise_goals(rows, LEVELS)["levels"]["beginner"]["grade_in_range"] == 0.5


def test_repeated_runs_show_their_spread():
    rows = [goal_row("beginner", "a", seconds=10.0), goal_row("beginner", "b", seconds=14.0), goal_row("beginner", "c", seconds=12.0)]
    level = summarise_goals(rows, LEVELS)["levels"]["beginner"]
    assert level["seconds"] == 12.0 and level["seconds_sd"] == 2.0


def test_a_single_run_has_no_spread():
    assert summarise_goals(goal_rows(), LEVELS)["levels"]["beginner"]["seconds_sd"] is None


def test_latency_is_summarised_per_kind_of_call():
    rows = [goal_row("beginner", "a", kind_seconds={"lesson": [2.0, 4.0]}), goal_row("beginner", "b", kind_seconds={"lesson": [6.0, 8.0]})]
    assert summarise_goals(rows, LEVELS)["latency"]["lesson"] == {"p50": 4.0, "p95": 8.0}


def test_document_runs_are_listed_by_case_with_numbers_only():
    document = {"suite": "goals", "kind": "document", "case": "plants", "ok": True, "modules": 2, "topics": 4, "seconds": 30.0, "tokens": 9000, "cost_usd": 0.002, "retry_rate": 0.0, "citations": 1.0, "duplicates": 0.0}
    assert summarise_goals([document], LEVELS)["documents"] == {"plants": {"ok": 1.0, "modules": 2, "topics": 4, "seconds": 30.0, "tokens": 9000, "cost_usd": 0.002, "retry_rate": 0.0, "citations": 1.0, "duplicates": 0.0}}


# --- Cost ---

def test_the_cost_adds_up_over_every_run():
    rows = [{"cost_usd": 0.001, "tokens": 5000, "calls": 5}, {"cost_usd": 0.003, "tokens": 9000, "calls": 8}]
    assert summarise_cost(rows) == {"total_usd": 0.004, "per_run_usd": 0.002, "tokens": 14000, "calls": 13, "runs": 2}


def test_no_runs_cost_nothing():
    assert summarise_cost([]) == {"total_usd": 0, "per_run_usd": None, "tokens": 0, "calls": 0, "runs": 0}


# --- The whole summary ---

def test_every_suite_that_ran_gets_a_section():
    rows = goal_rows() + [
        {"suite": "safety", "ok": True, "expect": "refuse", "refused": True, "category": "harmful", "cost_usd": 0, "tokens": 0, "calls": 1},
        {"suite": "injection", "ok": True, "leaked": False, "refused": False, "cost_usd": 0, "tokens": 0, "calls": 1},
        {"suite": "tutor", "check": "spoiler", "ok": True, "cost_usd": 0, "tokens": 0, "calls": 1},
        {"suite": "placement", "ok": True, "valid": True, "agreement": 0.8, "cost_usd": 0, "tokens": 0, "calls": 1},
    ]
    assert set(build_summary(rows, LEVELS)) == {"goals", "safety", "injection", "tutor", "placement", "cost"}


def test_a_suite_that_did_not_run_has_no_section():
    assert set(build_summary(goal_rows(), LEVELS)) == {"goals", "cost"}


# --- Showing it ---

def test_the_report_has_a_row_per_level_latency_and_the_cost():
    text = render_markdown(build_summary(goal_rows(), LEVELS), META)
    assert "# Evaluation 2026-10-17" in text and "`nvidia/m`" in text and "`v1`" in text
    assert all(f"| {level} |" in text for level in LEVELS) and "Grade gap" in text and "| lesson | 4.0 | 4.0 |" in text
    assert "## Cost" in text and "estimated at the configured price" in text


def test_other_suites_are_listed_with_their_numbers():
    rows = [{"suite": "safety", "ok": True, "expect": "refuse", "refused": True, "category": "harmful", "cost_usd": 0, "tokens": 0, "calls": 1}]
    text = render_markdown(build_summary(rows, LEVELS), META)
    assert "## Safety" in text and "- recall: 1.0" in text


# --- Comparing and history ---

def test_a_comparison_shows_the_change_in_every_shared_number():
    old, new = build_summary(goal_rows(), LEVELS), build_summary([{**row, "tokens": 2500} for row in goal_rows()], LEVELS)
    assert "| goals.levels.beginner.tokens | 5000 | 2500 | -2500.000 |" in compare_summaries(old, new)


def test_a_comparison_skips_numbers_missing_on_one_side_and_noise():
    table = compare_summaries(build_summary(goal_rows(), LEVELS), build_summary(goal_rows(), LEVELS))
    assert "levels.beginner.judge |" not in table and ".latency." not in table and "_sd" not in table and ".runs" not in table


def save(path, meta, summary):
    path.write_text(json.dumps({"meta": meta, "summary": summary, "rows": []}))


def test_the_history_lists_saved_runs_oldest_first(tmp_path):
    save(tmp_path / "2026-10-16-a.json", {**META, "date": "2026-10-16", "promptVersion": "v1"}, build_summary(goal_rows(), LEVELS))
    save(tmp_path / "2026-10-17-a.json", {**META, "date": "2026-10-17", "promptVersion": "v2"}, build_summary(goal_rows(), LEVELS))
    lines = history_table(tmp_path).strip().splitlines()
    assert lines[2].startswith("| 2026-10-16 | m | v1 |") and lines[3].startswith("| 2026-10-17 | m | v2 |")


def test_the_history_shows_the_headline_numbers(tmp_path):
    save(tmp_path / "run.json", META, build_summary(goal_rows(), LEVELS))
    row = history_table(tmp_path).strip().splitlines()[2]
    assert "| 1.0 |" in row and "0.001" in row


def test_an_empty_history_is_just_the_header(tmp_path):
    assert len(history_table(tmp_path).strip().splitlines()) == 2


def test_the_module_does_not_depend_on_a_model_choice():
    assert not hasattr(report, "model")
