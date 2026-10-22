import json

import pytest

from evals import run_eval
from evals.run_eval import main, parse_args


@pytest.fixture(autouse=True)
def keep_environment(monkeypatch):
    """A run changes two settings for itself; the other tests must get theirs back."""
    monkeypatch.setenv("NOVA_RATE_LIMIT", "restored-by-monkeypatch")
    monkeypatch.setenv("NOVA_MODERATION", "off")


@pytest.fixture
def results(tmp_path):
    return tmp_path / "results"


def eval_args(results, *extra) -> list:
    return ["--out", str(results), *extra]


# --- Arguments ---

def test_the_defaults_run_every_suite_on_the_smoke_cases_once():
    args = parse_args([])
    assert (args.suite, args.cases, args.repeat, args.judge, args.baseline, args.fail_on_regression) == ("all", "smoke", 1, False, None, False)


def test_the_command_line_has_no_model_switch(monkeypatch, capsys):
    monkeypatch.setattr("sys.argv", ["run_eval", "--model", "other/model"])
    with pytest.raises(SystemExit):
        parse_args()
    assert "unrecognized arguments: --model" in capsys.readouterr().err


def test_every_suite_can_be_chosen():
    assert {parse_args(["--suite", name]).suite for name in ("goals", "safety", "injection", "tutor", "placement", "all")} == {"goals", "safety", "injection", "tutor", "placement", "all"}


def test_an_unknown_suite_is_refused():
    with pytest.raises(SystemExit):
        parse_args(["--suite", "everything"])


# --- A run ---

def test_a_run_writes_the_results_and_a_report(fake_model, results, capsys):
    assert main(eval_args(results, "--suite", "goals")) == 0
    files = sorted(path.name for path in results.iterdir())
    assert len(files) == 2 and files[0].endswith("-smoke-goals.json") and files[1].endswith("-smoke-goals.md")
    assert "# Evaluation" in capsys.readouterr().out


def test_the_saved_results_name_the_nano_model_and_prompt_version_without_lesson_text(fake_model, results):
    main(eval_args(results, "--suite", "goals"))
    saved = json.loads(next(results.glob("*.json")).read_text())
    assert saved["meta"]["model"] == "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B" and saved["meta"]["promptVersion"] and saved["meta"]["suites"] == "goals"
    assert saved["rows"] and all("text" not in row for row in saved["rows"]) and "goals" in saved["summary"] and "cost" in saved["summary"]


def test_repeating_runs_each_course_case_again(fake_model, results):
    main(eval_args(results, "--suite", "goals", "--repeat", "2"))
    rows = json.loads(next(results.glob("*.json")).read_text())["rows"]
    assert len([row for row in rows if row["kind"] == "goal"]) == 2 * 2 * 3


def test_a_run_turns_off_rate_limits_and_turns_on_the_goal_check(fake_model, results):
    main(eval_args(results, "--suite", "safety"))
    import os

    assert os.environ["NOVA_RATE_LIMIT"] == "off" and os.environ["NOVA_MODERATION"] == "on"


def test_the_judge_adds_scores(fake_model, results):
    main(eval_args(results, "--suite", "goals", "--judge"))
    rows = json.loads(next(results.glob("*.json")).read_text())["rows"]
    assert all("judge" in row and "questions_judge" in row for row in rows if row["kind"] == "goal")


# --- The gate ---

def write_baseline(results, tmp_path, **goal_metrics):
    main(eval_args(results, "--suite", "goals"))
    baseline = json.loads(next(results.glob("*.json")).read_text())
    for style in baseline["summary"]["goals"]["styles"].values():
        style.update(goal_metrics)
    path = tmp_path / "baseline.json"
    path.write_text(json.dumps(baseline))
    for file in results.iterdir():
        file.unlink()
    return path


def write_rules(tmp_path, rules):
    path = tmp_path / "rules.json"
    path.write_text(json.dumps({"rules": rules}))
    return str(path)


def test_without_a_baseline_the_fixed_thresholds_still_apply(fake_model, results, tmp_path, capsys):
    rules = write_rules(tmp_path, [{"metric": "goals.styles.*.ok", "at_least": 1.5}])
    assert main(eval_args(results, "--suite", "goals", "--thresholds", rules)) == 0
    assert "thresholds broken" in capsys.readouterr().out


def test_a_broken_threshold_fails_the_run_only_when_asked(fake_model, results, tmp_path):
    rules = write_rules(tmp_path, [{"metric": "goals.styles.*.ok", "at_least": 1.5}])
    assert main(eval_args(results, "--suite", "goals", "--thresholds", rules, "--fail-on-regression")) == 1


def test_a_run_that_holds_every_threshold_passes(fake_model, results, tmp_path, capsys):
    rules = write_rules(tmp_path, [{"metric": "goals.styles.*.ok", "at_least": 0.5}])
    assert main(eval_args(results, "--suite", "goals", "--thresholds", rules, "--fail-on-regression")) == 0
    assert "every threshold holds" in capsys.readouterr().out


def test_a_run_that_matches_its_baseline_passes_the_relative_rules(fake_model, results, tmp_path):
    baseline = write_baseline(results, tmp_path, duplicates=0.0, first_try=1.0)
    rules = write_rules(tmp_path, [{"metric": "goals.styles.*.duplicates", "rise_at_most_share": 0.1}, {"metric": "goals.styles.*.first_try", "drop_at_most": 0.1}])
    assert main(eval_args(results, "--suite", "goals", "--baseline", str(baseline), "--thresholds", rules, "--fail-on-regression")) == 0


def test_a_baseline_that_is_better_than_the_run_makes_the_gate_fail(fake_model, results, tmp_path, capsys):
    baseline = write_baseline(results, tmp_path, grade=20.0, seconds=100.0, questions_judge=5.0, judge=5.0)
    rules = write_rules(tmp_path, [{"metric": "goals.styles.*.judge", "drop_at_most": 0.3}])
    code = main(eval_args(results, "--suite", "goals", "--judge", "--baseline", str(baseline), "--thresholds", rules, "--fail-on-regression"))
    assert code == 1 and "may fall at most" in capsys.readouterr().out


# --- Other commands ---

def test_the_history_lists_saved_runs(fake_model, results, capsys):
    main(eval_args(results, "--suite", "goals"))
    capsys.readouterr()
    assert main(eval_args(results, "--history")) == 0
    assert "| date | model |" in capsys.readouterr().out


def test_two_saved_runs_can_be_compared(fake_model, results, capsys):
    main(eval_args(results, "--suite", "goals"))
    first = next(results.glob("*.json"))
    capsys.readouterr()
    assert main(["--compare", str(first), str(first)]) == 0
    assert "| metric | before | after | change |" in capsys.readouterr().out


def test_the_runner_never_mentions_a_model_option():
    assert "--model" not in run_eval.__doc__
