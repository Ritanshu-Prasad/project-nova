import asyncio
import json
import re

import pytest

import llm
from evals import bank_eval, cases, module_eval, report
from module_content import CODE_CHECK_SYSTEM
from test_module_content import code_section, module, section
from test_question_bank import mcq, msq, true_false

TOPICS = cases.load("modules")["modules"]


def run(coroutine):
    return asyncio.run(coroutine)


# --- Cases ---

def test_the_module_cases_cover_technical_and_non_technical_topics_and_mark_ambiguous_ones():
    assert {case["requires_code"] for case in TOPICS} == {True, False, None}
    assert all(case["topic"] and case["expectations"] for case in TOPICS)
    assert sum(1 for case in TOPICS if case.get("smoke") and case["requires_code"]) >= 2
    assert sum(1 for case in TOPICS if case.get("smoke") and case["requires_code"] is False) >= 2


# --- A scripted model ---

@pytest.fixture
def model(monkeypatch):
    """Answers the code question with `verdict`, writes a module under the code rule it was given and a clean bank for it."""

    class Model:
        verdict = False
        spoil_first_true_false = False

    state = Model()

    async def chat_json(system, user, max_tokens=0, thinking=False, schema=None, kind="call"):
        if system == CODE_CHECK_SYSTEM:
            return {"requires_code": state.verdict, "reason": "because"}
        if "careful fact checker" in system:
            return {"doubtful": []}
        if "curriculum designer" in system:
            sections = [section(), section(), code_section()] if "MUST have" in system else [section(), section(), section()]
            return module(requires_code="MUST have" in system, sections=sections)
        kind_asked = re.search(r"of type (\w+),", user).group(1)
        numbers = [int(number) for number in re.findall(r"section (\d+)", user.split("Write exactly")[1])]
        make = {"mcq": mcq, "msq": msq, "true_false": true_false}[kind_asked]
        questions = [make(n, number) for n, number in enumerate(numbers, 1)]
        if kind_asked == "true_false" and state.spoil_first_true_false:
            state.spoil_first_true_false = False  # only the first answer is wrong
            questions[0] = {**questions[0], "question_text": "Which of these is a statement about habits?"}
        return {"questions": questions}

    monkeypatch.setattr(llm, "chat_json", chat_json)
    return state


# --- Modules ---

def case(requires_code):
    return {"id": "x", "topic": "A topic", "expectations": "short", "requires_code": requires_code}


def test_a_module_row_records_the_decision_the_sections_and_the_code(model):
    model.verdict = True
    row = run(module_eval.check(case(True)))
    assert row["ok"] and row["decided"] is True and row["requires_code"] and row["sections"] == 3 and row["code_sections"] == 1 and row["cost_usd"] == 0


def test_the_summary_scores_decisions_and_code_but_not_ambiguous_cases():
    rows = [
        {"ok": True, "expected": True, "decided": True, "code_sections": 2, "sections": 4, "repeated_extras": 0, "sections_with_lists": 2, "simple_grade": 5.0},
        {"ok": True, "expected": False, "decided": True, "code_sections": 1, "sections": 5, "repeated_extras": 1, "sections_with_lists": 1, "simple_grade": 7.0},
        {"ok": True, "expected": False, "decided": False, "code_sections": 0, "sections": 3, "repeated_extras": 0, "sections_with_lists": 2, "simple_grade": 6.0},
        {"ok": True, "expected": None, "decided": True, "code_sections": 3, "sections": 4, "repeated_extras": 0, "sections_with_lists": 2, "simple_grade": 6.0},
        {"ok": False, "expected": True, "decided": True, "error": "x"},
    ]
    summary = module_eval.summarise(rows)
    assert summary["runs"] == 5 and summary["ok_rate"] == 0.8
    assert summary["decision_accuracy"] == 0.75 and summary["code_when_needed"] == 1.0 and summary["no_code_when_not_needed"] == 0.5
    assert summary["average_sections"] == 4.0
    assert summary["repeated_extras"] == 1 and summary["simple_grade"] == 6.0 and summary["sections_with_lists"] == 1.75


def test_a_whole_run_goes_through_every_smoke_topic(model):
    rows = run(module_eval.run("smoke"))
    assert len(rows) == sum(1 for case in TOPICS if case.get("smoke")) and all(row["ok"] for row in rows)


# --- Bank ---

def test_a_clean_first_pass_is_recorded_as_fully_clean(model):
    row = run(bank_eval.check(case(False)))
    assert row["ok"] and row["questions"] == 8 and row["clean_share"] == 1.0


def test_a_question_that_needed_a_rewrite_lowers_the_clean_share(model):
    model.spoil_first_true_false = True
    row = run(bank_eval.check(case(False)))
    assert row["ok"] and row["clean_share"] == 7 / 8


def test_the_bank_summary_averages_the_first_pass_and_counts_failures():
    rows = [{"ok": True, "clean_share": 1.0, "first_try": 1.0}, {"ok": True, "clean_share": 0.5, "first_try": 0.5}, {"ok": False, "first_try": 1.0}]
    summary = bank_eval.summarise(rows)
    assert summary["runs"] == 3 and summary["clean_share"] == 0.75 and summary["first_try"] == pytest.approx(2.5 / 3)
    assert summary["ok_rate"] == pytest.approx(2 / 3)


# --- In the report ---

def test_the_report_has_a_section_for_each_new_suite():
    rows = [{"suite": "modules", "ok": True, "expected": False, "decided": False, "code_sections": 0, "sections": 3, "repeated_extras": 0, "sections_with_lists": 2, "simple_grade": 6.0, "cost_usd": 0.001, "tokens": 100, "calls": 2},
            {"suite": "bank", "ok": True, "clean_share": 1.0, "first_try": 1.0, "cost_usd": 0.001, "tokens": 100, "calls": 2}]
    summary = report.build_summary(rows, ["beginner"])
    text = report.render_markdown(summary, {"date": "2026-01-01", "model": "m", "promptVersion": "p", "cases": "smoke", "suites": "all", "repeat": 1})
    assert "## Modules" in text and "## Bank" in text and summary["modules"]["decision_accuracy"] == 1.0


# --- Cases saved from real problems ---

def test_cases_saved_from_real_problems_always_run_after_the_listed_topics(tmp_path, monkeypatch):
    monkeypatch.setattr(cases, "DIRECTORY", tmp_path)
    (tmp_path / "modules.json").write_text(json.dumps({"modules": [{"id": "a", "smoke": True}, {"id": "b"}]}))
    assert [case["id"] for case in cases.module_cases("smoke")] == ["a"]
    (tmp_path / "from_traces.json").write_text(json.dumps({"modules": [{"id": "seen"}]}))
    assert [case["id"] for case in cases.module_cases("smoke")] == ["a", "seen"]
    assert [case["id"] for case in cases.module_cases("full")] == ["a", "b", "seen"]
