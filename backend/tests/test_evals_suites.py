import asyncio
import json

import httpx
import pytest
from fastapi import FastAPI, HTTPException

import generator
import tutor
from course_models import Lesson
from evals import cases, goal_eval, injection_eval, placement_eval, safety_eval, tutor_eval
from evals.cases import chosen
from evals.goal_eval import lesson_text, run_document, run_goal
from samples import lesson_json

GOALS = cases.load("goals")
DOCUMENTS = cases.load("documents")


def run(coro):
    return asyncio.run(coro)


# --- Cases ---

def test_the_case_files_have_what_the_suites_need():
    assert GOALS["levels"] == ["beginner", "intermediate", "advanced"] and all(case["id"] and case["goal"] for case in GOALS["goals"])
    assert all(case["name"].endswith(".pdf") and case["pages"] for case in DOCUMENTS["documents"])
    assert all(case["expect"] in {"allow", "refuse"} and case["kind"] in {"benign", "sensitive", "harmful", "injection"} for case in cases.load("safety")["goals"])
    attacks = cases.load("injection")
    assert attacks["planted"] and attacks["goals"] and all(attacks["planted"] in document["pages"][1] for document in attacks["documents"])
    plan = cases.load("tutor")
    assert plan["spoilers"] and plan["quiz_requests"] and plan["off_topic"] and plan["grounded"]["facts"]


def test_the_safety_cases_cover_every_kind_and_injections_are_expected_to_be_refused():
    goals = cases.load("safety")["goals"]
    assert {case["kind"] for case in goals} == {"benign", "sensitive", "harmful", "injection"}
    assert all(case["expect"] == "refuse" for case in goals if case["kind"] in {"harmful", "injection"})


def test_the_smoke_set_is_smaller_than_the_full_set():
    assert 0 < len(chosen(GOALS["goals"], "smoke")) < len(chosen(GOALS["goals"], "full"))


def test_every_grounded_fact_names_a_real_page_and_keyword():
    plan = cases.load("tutor")["grounded"]
    pages = plan["document"]["pages"]
    for fact in plan["facts"]:
        assert fact["keywords"] and 1 <= fact["page"] <= len(pages)
        assert all(word.lower() in pages[fact["page"] - 1].lower() for word in fact["keywords"])


def test_the_grounded_facts_are_not_general_knowledge():
    facts = cases.load("tutor")["grounded"]["facts"]
    assert all(not any(common in fact["question"] for common in ("rubisco", "photosynthesis")) for fact in facts)


def test_the_graded_questions_of_a_spoiler_case_belong_to_its_lesson():
    for case in cases.load("tutor")["spoilers"]:
        assert len(case["graded"]) >= 3 and case["lesson"]


# --- Goal runs ---

def test_a_goal_run_reports_quality_and_cost(fake_model):
    row = run(run_goal(GOALS["goals"][0], "beginner", judge=False))
    assert row["ok"] and row["suite"] == "goals" and row["kind"] == "goal" and row["level"] == "beginner"
    assert row["questions"] == 8 and row["duplicates"] == 0.0 and 0.0 <= row["agreement"] <= 1.0 and row["grade"] > 0
    assert {"seconds", "calls", "prompt_tokens", "completion_tokens", "tokens", "cost_usd", "retries", "retry_rate", "first_try", "kind_seconds", "mix", "grade_ok"} <= set(row)


def test_a_goal_run_can_include_reviews_of_the_lesson_and_the_questions(fake_model):
    row = run(run_goal(GOALS["goals"][0], "advanced", judge=True))
    assert row["judge"] == 4.5 and row["judge_notes"] == "none" and row["questions_judge"] == pytest.approx(13 / 3)


def test_a_failing_run_is_reported_not_raised(fake_model):
    fake_model.replies = [HTTPException(503, "busy")]
    row = run(run_goal(GOALS["goals"][0], "beginner", judge=False))
    assert row["ok"] is False and row["error"] == "busy"


def test_the_row_has_no_leftover_timer(fake_model):
    assert "_started" not in run(run_goal(GOALS["goals"][0], "beginner", judge=False))


def test_a_document_run_builds_a_course_and_checks_its_quotes(fake_model):
    row = run(run_document(DOCUMENTS["documents"][0], "intermediate"))
    assert row["ok"] and row["modules"] >= 1 and row["topics"] >= 1 and row["citations"] == 1.0 and row["suite"] == "goals"


def test_a_document_run_restores_the_verifier_even_when_it_fails(fake_model):
    original = generator.verify_sources
    run(run_document(DOCUMENTS["documents"][0], "intermediate"))
    fake_model.replies = [HTTPException(503, "busy")] * 10
    row = run(run_document(DOCUMENTS["documents"][0], "intermediate"))
    assert row["ok"] is False and generator.verify_sources is original


def test_the_lesson_text_gathers_the_prose_and_summary_points():
    text = lesson_text(Lesson.model_validate(lesson_json()))
    assert "A short version." in text and "Some body text." in text and "One point" in text


def test_all_goal_runs_are_repeated_when_asked(fake_model):
    rows = run(goal_eval.run("smoke", judge=False, repeat=2))
    goals = [row for row in rows if row["kind"] == "goal"]
    assert len(goals) == 2 * len(chosen(GOALS["goals"], "smoke")) * 3 and len([r for r in rows if r["kind"] == "document"]) == 1


# --- Safety ---

def test_a_harmful_goal_that_is_refused_is_correct(fake_model):
    fake_model.replies = [{"allowed": False, "reason": "No."}]
    row = run(safety_eval.check({"goal": "bad", "expect": "refuse", "kind": "harmful"}))
    assert row["ok"] and row["refused"] and row["correct"] and row["reason"] == "No."


def test_a_benign_goal_that_is_refused_is_a_false_refusal(fake_model):
    fake_model.replies = [{"allowed": False, "reason": "No."}]
    row = run(safety_eval.check({"goal": "docker", "expect": "allow", "kind": "benign"}))
    assert row["refused"] and not row["correct"]


def test_a_model_failure_is_an_error_not_an_allow(fake_model):
    fake_model.replies = [HTTPException(503, "busy")]
    row = run(safety_eval.check({"goal": "bad", "expect": "refuse", "kind": "harmful"}))
    assert row["ok"] is False and "refused" not in row


def test_the_safety_summary_has_precision_recall_and_false_refusals():
    rows = [
        {"ok": True, "expect": "refuse", "refused": True, "category": "harmful"},
        {"ok": True, "expect": "refuse", "refused": False, "category": "harmful"},
        {"ok": True, "expect": "allow", "refused": True, "category": "benign"},
        {"ok": True, "expect": "allow", "refused": False, "category": "sensitive"},
        {"ok": False, "error": "busy"},
    ]
    summary = safety_eval.summarise(rows)
    assert (summary["precision"], summary["recall"], summary["false_refusal_rate"], summary["sensitive_allowed_rate"], summary["errors"]) == (0.5, 0.5, 0.5, 1.0, 1)


def test_the_safety_summary_reports_how_many_injection_goals_were_refused():
    rows = [{"ok": True, "expect": "refuse", "refused": True, "category": "injection"}, {"ok": True, "expect": "refuse", "refused": False, "category": "injection"}]
    assert safety_eval.summarise(rows)["injection_refused_rate"] == 0.5


def test_the_safety_suite_runs_every_case(fake_model):
    rows = run(safety_eval.run("smoke"))
    assert len(rows) == len(cases.load("safety")["goals"]) and all(row["ok"] for row in rows)


# --- Injection ---

PLANTED = cases.load("injection")["planted"]


def test_a_goal_that_gets_its_way_is_a_leak(fake_model):
    fake_model.replies = [{**json.loads(json.dumps(__import__("samples").outline_json())), "title": f"All about {PLANTED}"}]
    row = run(injection_eval.run_goal(cases.load("injection")["goals"][0], PLANTED))
    assert row["ok"] and row["leaked"]


def test_a_goal_that_is_ignored_is_not_a_leak(fake_model):
    row = run(injection_eval.run_goal(cases.load("injection")["goals"][0], PLANTED))
    assert row["ok"] and not row["leaked"] and not row["refused"]


def test_a_refused_goal_counts_as_a_good_outcome(fake_model, monkeypatch):
    monkeypatch.delenv("NOVA_MODERATION")
    fake_model.replies = [{"allowed": False, "reason": "No."}]
    row = run(injection_eval.run_goal(cases.load("injection")["goals"][0], PLANTED))
    assert row["ok"] and row["refused"] and not row["leaked"]


def test_a_document_that_gets_its_way_is_a_leak(fake_model):
    from samples import module_json

    fake_model.replies = [{**module_json(), "title": PLANTED}]
    row = run(injection_eval.run_document(cases.load("injection")["documents"][0], PLANTED))
    assert row["ok"] and row["leaked"]


def test_a_document_that_is_ignored_is_not_a_leak(fake_model):
    row = run(injection_eval.run_document(cases.load("injection")["documents"][0], PLANTED))
    assert row["ok"] and not row["leaked"]


def test_the_injection_summary_counts_leaks_and_failures():
    rows = [{"ok": True, "leaked": False, "refused": False}, {"ok": True, "leaked": True, "refused": False}, {"ok": True, "leaked": False, "refused": True}, {"ok": False, "leaked": False, "refused": False}]
    assert injection_eval.summarise(rows) == {"runs": 4, "leaks": 1, "ok_rate": 0.75, "refused": 1}


def test_the_injection_suite_covers_every_goal_and_every_document(fake_model):
    attacks = cases.load("injection")
    assert len(run(injection_eval.run("smoke"))) == len(attacks["goals"]) + len(attacks["documents"])


# --- Placement ---

def test_a_good_placement_quiz_is_valid_and_its_keys_agree(fake_model):
    row = run(placement_eval.check(GOALS["goals"][0]))
    assert row["ok"] and row["valid"] and row["count"] == 5 and row["agreement"] == 1.0


def test_a_placement_quiz_that_cannot_be_written_is_invalid(fake_model):
    fake_model.replies = [HTTPException(503, "busy")]
    row = run(placement_eval.check(GOALS["goals"][0]))
    assert row["ok"] is False and row["valid"] is False


def test_the_placement_summary_has_the_valid_rate_and_agreement():
    assert placement_eval.summarise([{"valid": True, "agreement": 1.0}, {"valid": False, "agreement": 0.5}, {"valid": False}]) == {"runs": 3, "valid_rate": 1 / 3, "agreement": 0.75}


# --- Tutor ---

@pytest.fixture
def tutor_world(monkeypatch):
    """The tutor's model replaced by a script; the evaluation talks to the real route in-process."""
    real = httpx.AsyncClient
    replies = {"text": "Containers on a bridge talk by name."}
    monkeypatch.setenv("NEBIUS_API_KEY", "test-key")

    def upstream(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content).get("stream"):
            events = f"data: {json.dumps({'choices': [{'delta': {'content': replies['text']}}]})}\n\ndata: [DONE]\n\n"
            return httpx.Response(200, content=events.encode())
        return httpx.Response(200, json={"choices": [{"message": {"content": replies["text"]}}], "usage": {"prompt_tokens": 10, "completion_tokens": 5}})

    def make_tutor_client():
        app = FastAPI()
        app.include_router(tutor.router)
        return real(transport=httpx.ASGITransport(app=app), base_url="http://eval")

    monkeypatch.setattr(tutor.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(upstream), **kw))
    monkeypatch.setattr(tutor_eval, "client", make_tutor_client)
    return replies


SPOILER_CASE = cases.load("tutor")["spoilers"][0]


def test_a_practice_question_on_another_fact_passes(tutor_world, fake_model):
    async def go():
        async with tutor_eval.client() as http:
            return await tutor_eval.spoiler(http, SPOILER_CASE, "Quiz me")

    tutor_world["text"] = "Which driver connects containers on different hosts?"
    assert run(go())["ok"] is True


def test_a_graded_question_that_gets_through_is_a_spoiler(tutor_world, fake_model, monkeypatch):
    async def go():
        async with tutor_eval.client() as http:
            return await tutor_eval.spoiler(http, SPOILER_CASE, "Quiz me")

    monkeypatch.setattr(tutor, "find_clash", lambda reply, graded: None)
    tutor_world["text"] = "Which flag publishes a container port to the host?"
    row = run(go())
    assert row["ok"] is False and row["clash"] == "Which flag publishes a container port to the host?"


def test_the_tutors_own_guard_keeps_a_graded_question_from_reaching_the_learner(tutor_world, fake_model):
    async def go():
        async with tutor_eval.client() as http:
            return await tutor_eval.spoiler(http, SPOILER_CASE, "Quiz me")

    tutor_world["text"] = "Which flag publishes a container port to the host?"
    row = run(go())
    assert row["ok"] is True and row["reply"] == tutor.NO_FRESH_QUESTION[:300]


def test_an_unrelated_question_that_is_declined_passes(tutor_world, fake_model):
    async def go():
        async with tutor_eval.client() as http:
            return await tutor_eval.off_topic(http, SPOILER_CASE, "Write me a poem about cats.")

    tutor_world["text"] = "I can only help with this lesson."
    assert run(go())["ok"] is True


def test_an_unrelated_question_that_is_answered_fails(tutor_world, fake_model):
    async def go():
        async with tutor_eval.client() as http:
            return await tutor_eval.off_topic(http, SPOILER_CASE, "Write me a poem about cats.")

    fake_model.replies = [{"answered": True}]
    assert run(go())["ok"] is False


def test_a_grounded_answer_needs_the_keywords_and_reports_whether_it_cites_the_page(tutor_world, fake_model):
    async def go(text):
        tutor_world["text"] = text
        async with tutor_eval.client() as http:
            return await tutor_eval.grounded(http, "", {"question": "Which sugar?", "keywords": ["RuBP"], "page": 3}, cases.load("tutor")["grounded"], "grounded")

    cited, uncited, wrong = run(go("It is RuBP (page 3).")), run(go("It is RuBP.")), run(go("I do not know."))
    assert (cited["ok"], cited["cites_page"]) == (True, True) and (uncited["ok"], uncited["cites_page"]) == (True, False) and wrong["ok"] is False


def test_page_citations_in_several_styles_are_recognised(tutor_world, fake_model):
    async def cites(text):
        tutor_world["text"] = text
        async with tutor_eval.client() as http:
            return (await tutor_eval.grounded(http, "", {"question": "q", "keywords": ["x"], "page": 3}, cases.load("tutor")["grounded"], "grounded"))["cites_page"]

    assert all(run(cites(f"x {style}")) for style in ("p.3", "p. 3", "page 3", "Page 3", "pp. 3-4")) and not run(cites("x page 13"))


def test_the_tutor_summary_has_every_rate():
    rows = [
        {"check": "spoiler", "ok": True}, {"check": "spoiler", "ok": False},
        {"check": "off_topic", "ok": True},
        {"check": "grounded", "ok": True, "cites_page": True}, {"check": "grounded", "ok": True, "cites_page": False}, {"check": "grounded", "ok": False, "cites_page": False},
        {"check": "ungrounded", "ok": False},
    ]
    summary = tutor_eval.summarise(rows)
    assert (summary["spoiler_rate"], summary["off_topic_refusal_rate"], summary["grounded_rate"], summary["grounded_page_rate"], summary["ungrounded_rate"]) == (0.5, 1.0, 2 / 3, 0.5, 0.0)


def test_the_tutor_suite_runs_all_its_checks(tutor_world, fake_model):
    rows = run(tutor_eval.run("smoke"))
    assert {row["check"] for row in rows} == {"spoiler", "off_topic", "grounded", "ungrounded"}
    assert sum(row["check"] == "grounded" for row in rows) == len(cases.load("tutor")["grounded"]["facts"])


def test_the_grounded_control_runs_without_the_documents_key(tutor_world, fake_model):
    seen = []
    original = tutor_eval.ask

    async def spy(http, message, context):
        seen.append(context.get("documentsKey"))
        return await original(http, message, context)

    tutor_eval.ask = spy
    try:
        run(tutor_eval.run("smoke"))
    finally:
        tutor_eval.ask = original
    assert any(key for key in seen) and any(key == "" for key in seen)
