import json

from evals import gate
from evals.gate import Violation, check, flatten, load_rules

SUMMARY = {"goals": {"levels": {"beginner": {"ok": 1.0, "judge": 4.2, "runs": 3}, "advanced": {"ok": 0.9, "judge": 3.5}}, "level_gap": 1.6, "documents": {"plants": {"citations": 0.8}}}, "safety": {"recall": 0.95, "precision": None}, "cost": {"per_run_usd": 0.002}}


# --- flatten ---

def test_numbers_are_listed_under_dotted_names():
    flat = flatten(SUMMARY)
    assert flat["goals.levels.beginner.ok"] == 1.0 and flat["goals.level_gap"] == 1.6 and flat["safety.recall"] == 0.95 and flat["cost.per_run_usd"] == 0.002


def test_missing_values_lists_and_booleans_are_left_out():
    flat = flatten({**SUMMARY, "flag": True})
    assert "safety.precision" not in flat and "goals.documents.plants" not in flat and flat["goals.documents.plants.citations"] == 0.8 and "flag" not in flat


# --- rules ---

def violations(current, baseline, *rules):
    return check(flatten(current), flatten(baseline), list(rules))


def test_a_value_below_its_minimum_is_a_violation():
    found = violations(SUMMARY, {}, {"metric": "goals.levels.advanced.ok", "at_least": 0.95})
    assert found == [Violation("goals.levels.advanced.ok", "must be at least", 0.9, 0.95)]


def test_a_value_at_its_minimum_passes():
    assert violations(SUMMARY, {}, {"metric": "goals.levels.advanced.ok", "at_least": 0.9}) == []


def test_a_value_above_its_maximum_is_a_violation():
    assert [v.metric for v in violations({"tutor": {"spoiler_rate": 0.3}}, {}, {"metric": "tutor.spoiler_rate", "at_most": 0.1})] == ["tutor.spoiler_rate"]


def test_a_fall_against_the_baseline_is_a_violation_only_when_big_enough():
    baseline = {"goals": {"levels": {"beginner": {"judge": 4.6}}}}
    assert violations(SUMMARY, baseline, {"metric": "goals.levels.beginner.judge", "drop_at_most": 0.3}) == [Violation("goals.levels.beginner.judge", "may fall at most", 4.2, 0.3, 4.6)]
    assert violations(SUMMARY, {"goals": {"levels": {"beginner": {"judge": 4.4}}}}, {"metric": "goals.levels.beginner.judge", "drop_at_most": 0.3}) == []


def test_a_rise_against_the_baseline_is_measured_as_a_share():
    rule = {"metric": "cost.per_run_usd", "rise_at_most_share": 0.5}
    assert violations({"cost": {"per_run_usd": 0.0031}}, {"cost": {"per_run_usd": 0.002}}, rule) != []
    assert violations({"cost": {"per_run_usd": 0.0029}}, {"cost": {"per_run_usd": 0.002}}, rule) == []


def test_rules_against_a_baseline_are_skipped_without_one():
    assert violations(SUMMARY, {}, {"metric": "goals.levels.*.judge", "drop_at_most": 0.01}, {"metric": "cost.per_run_usd", "rise_at_most_share": 0.0}) == []


def test_a_wildcard_applies_to_every_matching_metric():
    found = violations(SUMMARY, {}, {"metric": "goals.levels.*.ok", "at_least": 0.95})
    assert [v.metric for v in found] == ["goals.levels.advanced.ok"]


def test_a_rule_for_a_suite_that_was_not_run_is_skipped():
    assert violations({"cost": {"per_run_usd": 0.1}}, {}, {"metric": "tutor.spoiler_rate", "at_most": 0.1}) == []


def test_every_broken_rule_is_reported():
    current = {"safety": {"recall": 0.5, "precision": 0.5}}
    assert len(violations(current, {}, {"metric": "safety.recall", "at_least": 0.9}, {"metric": "safety.precision", "at_least": 0.9})) == 2


def test_a_violation_describes_itself_with_its_baseline():
    text = Violation("goals.levels.beginner.judge", "may fall at most", 4.2, 0.3, 4.6).describe()
    assert "goals.levels.beginner.judge = 4.2" in text and "may fall at most 0.3" in text and "baseline 4.6" in text


# --- the shipped rules ---

def test_the_shipped_thresholds_are_well_formed():
    rules = load_rules(gate.Path(gate.__file__).parent / "thresholds.json")
    kinds = {"at_least", "at_most", "drop_at_most", "rise_at_most_share"}
    assert rules and all("metric" in rule and len(kinds & set(rule)) == 1 for rule in rules)


def test_the_shipped_thresholds_name_metrics_the_report_produces():
    from evals import report

    summary = report.build_summary([], ["beginner"])
    assert "cost" in summary
    rules = load_rules(gate.Path(gate.__file__).parent / "thresholds.json")
    assert {rule["metric"].split(".")[0] for rule in rules} <= {"goals", "cost", *report.SECTIONS}


def test_rules_are_read_from_a_file(tmp_path):
    path = tmp_path / "rules.json"
    path.write_text(json.dumps({"rules": [{"metric": "a", "at_least": 1}]}))
    assert load_rules(path) == [{"metric": "a", "at_least": 1}]
