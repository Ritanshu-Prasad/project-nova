import asyncio
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import admin
import module_content
import observability
import question_bank
import shared
import traces
import usage
from test_module_content import module, section

MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
TOKEN = "s3cret-token"


def run(coroutine):
    return asyncio.run(coroutine)


def spent_with_calls(count=2, failures=0):
    spent = usage.begin()
    for _ in range(count):
        run(usage.record_call("lesson", MODEL, {"prompt_tokens": 1000, "completion_tokens": 500}, 2.0))
    for _ in range(failures):
        run(usage.record_failure("quiz", MODEL))
    return spent


def record(**changes):
    return {**traces.build_record(spent_with_calls(), "req1", "POST", "/api/courses/generate", 200, 4.5), **changes}


# --- The record ---

def test_a_record_has_the_totals_each_call_and_no_text_by_default():
    spent = spent_with_calls(2)
    result = traces.build_record(spent, "req1", "POST", "/api/courses/generate", 200, 4.567)
    assert result["calls"] == 2 and result["prompt_tokens"] == 2000 and result["completion_tokens"] == 1000 and result["seconds"] == 4.57
    assert result["cost_usd"] == pytest.approx(0.00036) and [call["kind"] for call in result["call_log"]] == ["lesson", "lesson"]
    assert "exchanges" not in result and result["problem"] is False


@pytest.mark.parametrize("changes", [{"failures": 1}, {"notes": 1}, {"status": 500}])
def test_a_request_with_a_failure_a_remark_or_an_error_status_is_a_problem(changes):
    spent = spent_with_calls(1, failures=changes.get("failures", 0))
    if changes.get("notes"):
        usage.note("something was rewritten")
    assert traces.build_record(spent, "r", "GET", "/x", changes.get("status", 200), 1)["problem"] is True


def test_a_failed_call_is_in_the_call_log():
    spent = spent_with_calls(1, failures=1)
    assert spent.call_log[-1] == {"kind": "quiz", "model": MODEL, "prompt_tokens": 0, "completion_tokens": 0, "seconds": 0, "ok": False}


# --- Text of the calls ---

def test_the_text_of_calls_is_kept_only_when_asked_for(monkeypatch):
    monkeypatch.delenv("NOVA_TRACE_CONTENT", raising=False)
    spent = usage.begin()
    usage.record_exchange("lesson", "SYSTEM", "what a learner typed", "REPLY")
    assert spent.exchanges == []
    monkeypatch.setenv("NOVA_TRACE_CONTENT", "on")
    usage.record_exchange("lesson", "SYSTEM", "what a learner typed", "REPLY")
    assert spent.exchanges == [{"kind": "lesson", "system": "SYSTEM", "user": "what a learner typed", "reply": "REPLY"}]
    assert traces.build_record(spent, "r", "GET", "/x", 200, 1)["exchanges"] == spent.exchanges


def test_each_text_is_cut_and_the_number_of_exchanges_is_limited(monkeypatch):
    monkeypatch.setenv("NOVA_TRACE_CONTENT", "on")
    spent = usage.begin()
    for _ in range(usage.MAX_EXCHANGES + 5):
        usage.record_exchange("lesson", "s" * 5000, "u", "r")
    assert len(spent.exchanges) == usage.MAX_EXCHANGES and len(spent.exchanges[0]["system"]) == usage.EXCHANGE_CHARS


def test_remarks_are_limited_and_cut():
    spent = usage.begin()
    for _ in range(usage.MAX_NOTES + 5):
        usage.note("x" * 1000)
    assert len(spent.notes) == usage.MAX_NOTES and len(spent.notes[0]) == 300


# --- Keeping them ---

def test_records_come_back_newest_first_with_a_limit():
    for number, stamp in enumerate(["2026-10-21T10:00:00Z", "2026-10-21T12:00:00Z", "2026-10-21T11:00:00Z"]):
        run(traces.save(record(request_id=f"r{number}", time=stamp)))
    assert [item["request_id"] for item in run(traces.recent(10))] == ["r1", "r2", "r0"]
    assert [item["request_id"] for item in run(traces.recent(2))] == ["r1", "r2"]


def test_only_the_problems_can_be_asked_for():
    run(traces.save(record(request_id="fine", problem=False))), run(traces.save(record(request_id="bad", problem=True)))
    assert [item["request_id"] for item in run(traces.recent(10, only_problems=True))] == ["bad"]


def test_a_day_keeps_only_the_newest_records(monkeypatch):
    monkeypatch.setattr(traces, "MAX_PER_DAY", 3)
    for number in range(5):
        run(traces.save(record(request_id=f"r{number}", time=f"2026-10-21T10:00:0{number}Z")))
    assert [item["request_id"] for item in run(traces.recent(10))] == ["r4", "r3", "r2"]


def test_a_store_that_cannot_be_reached_is_survived(monkeypatch):
    async def broken(*_):
        raise shared.StateError("down")

    monkeypatch.setattr(shared.state, "push_capped", broken)
    monkeypatch.setattr(shared.state, "recent", broken)
    run(traces.save(record()))
    assert run(traces.recent(10)) == []


# --- Saved by the request log ---

@pytest.fixture
def app():
    app = FastAPI()
    observability.add_request_logging(app)

    @app.get("/model")
    async def model():
        await usage.record_call("lesson", MODEL, {"prompt_tokens": 100, "completion_tokens": 50}, 1.0)
        usage.note("rewrote one question")
        return "ok"

    @app.get("/plain")
    async def plain():
        return "ok"

    return TestClient(app)


def test_a_request_that_used_the_model_is_saved_once_with_its_remarks(app):
    app.get("/model", headers={"x-request-id": "abc123"})
    (saved,) = run(traces.recent(10))
    assert saved["request_id"] == "abc123" and saved["path"] == "/model" and saved["calls"] == 1 and saved["notes"] == ["rewrote one question"] and saved["problem"]


def test_a_request_that_did_not_use_the_model_is_not_saved(app):
    app.get("/plain")
    assert run(traces.recent(10)) == []


def test_a_broken_store_does_not_break_the_request(app, monkeypatch):
    async def broken(*_):
        raise shared.StateError("down")

    monkeypatch.setattr(shared.state, "push_capped", broken)
    assert app.get("/model").status_code == 200


# --- Admin ---

@pytest.fixture
def admin_client(monkeypatch):
    monkeypatch.setenv("NOVA_ADMIN_TOKEN", TOKEN)
    app = FastAPI()
    app.include_router(admin.router)
    return TestClient(app)


def auth(token=TOKEN):
    return {"Authorization": f"Bearer {token}"}


def test_the_admin_list_needs_the_token(admin_client):
    assert admin_client.get("/api/admin/traces").status_code == 401
    assert admin_client.get("/api/admin/traces", headers=auth("wrong")).status_code == 401


def test_the_admin_list_returns_records_and_says_whether_text_is_saved(admin_client, monkeypatch):
    run(traces.save(record(request_id="r1")))
    monkeypatch.delenv("NOVA_TRACE_CONTENT", raising=False)
    body = admin_client.get("/api/admin/traces", headers=auth()).json()
    assert [item["request_id"] for item in body["traces"]] == ["r1"] and body["content_saved"] is False
    monkeypatch.setenv("NOVA_TRACE_CONTENT", "on")
    assert admin_client.get("/api/admin/traces", headers=auth()).json()["content_saved"] is True


def test_the_admin_list_honours_the_limit_and_the_problem_filter(admin_client):
    for number in range(4):
        run(traces.save(record(request_id=f"r{number}", problem=number == 2, time=f"2026-10-21T10:00:0{number}Z")))
    assert len(admin_client.get("/api/admin/traces?limit=2", headers=auth()).json()["traces"]) == 2
    assert [item["request_id"] for item in admin_client.get("/api/admin/traces?problems=true", headers=auth()).json()["traces"]] == ["r2"]
    assert admin_client.get("/api/admin/traces?limit=0", headers=auth()).status_code == 422


def test_the_page_has_the_recent_requests_section(admin_client):
    page = admin_client.get("/api/admin").text
    assert "Recent requests" in page and "/api/admin/traces" in page


# --- Remarks from the writers ---

def test_a_bank_that_needed_rewrites_leaves_remarks_on_the_request(monkeypatch):
    from test_question_bank import content, good_questions

    spent = usage.begin()
    first = good_questions()
    first[6] = {**first[6], "question_text": "Which habit idea does the module describe best?"}
    answers = {"mcq": first[0:4], "msq": first[4:6], "true_false": first[6:8]}
    fixed = [good_questions()[6]]
    calls = {"true_false": [first[6:8], fixed]}

    async def fake_ask(schema, system, user, max_tokens=0, thinking=False, kind="call"):
        kind_asked = next(name for name in answers if f"of type {name}," in user)
        batch = calls[kind_asked].pop(0) if kind_asked in calls else answers[kind_asked]
        return schema.model_validate({"questions": batch})

    monkeypatch.setattr(question_bank.llm, "ask", fake_ask)
    module_ = content()
    run(question_bank.write_bank(module_))
    assert len(spent.notes) == 1 and "question bank, attempt 1: 1 problem(s)" in spent.notes[0]


def test_a_module_that_broke_the_code_rule_leaves_a_remark(monkeypatch):
    spent = usage.begin()
    answers = [module(), module(requires_code=True, sections=[section(), section(), module_content.ModuleContent.model_validate(module()).sections[0].model_copy(update={"code": {"language": "python", "snippet": "print(1)", "explanation": "Prints one."}})])]

    async def fake_ask(schema, system, user, max_tokens=0, thinking=False, kind="call"):
        if schema is module_content.CodeVerdict:
            return schema(requires_code=True)
        return schema.model_validate(answers.pop(0))

    monkeypatch.setattr(module_content.llm, "ask", fake_ask)
    result = run(module_content.write_module("Git", "", []))
    assert result.requires_code and spent.notes == ["module: wrote requires_code=False but True was decided, asked again"]


# --- Failures become eval cases ---

def test_problem_requests_with_text_become_cases(tmp_path):
    from evals import from_traces

    prompt = "<topic>Git branching</topic>\n<expectations>new to teams</expectations>\n<previous_modules>\n\n</previous_modules>"
    records = [
        {"request_id": "bad1", "problem": True, "notes": ["question bank, attempt 1: 2 problem(s): evidence"], "exchanges": [{"kind": "lesson", "user": prompt}, {"kind": "quiz", "user": "no tags here"}]},
        {"request_id": "bad2", "problem": True, "notes": [], "exchanges": [{"kind": "lesson", "user": prompt}]},
        {"request_id": "fine", "problem": False, "exchanges": [{"kind": "lesson", "user": "<topic>Other</topic>"}]},
        {"request_id": "notext", "problem": True, "notes": ["x"]},
    ]
    assert from_traces.cases_from(records) == [{"id": "bad1", "topic": "Git branching", "expectations": "new to teams", "requires_code": None, "note": "question bank, attempt 1: 2 problem(s): evidence"}]
    source, out = tmp_path / "traces.json", tmp_path / "cases.json"
    source.write_text(json.dumps({"traces": records}))
    assert from_traces.main(["--file", str(source), "--out", str(out)]) == 0
    assert json.loads(out.read_text())["modules"][0]["topic"] == "Git branching"
