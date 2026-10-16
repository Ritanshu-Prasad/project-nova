import asyncio

import pytest
from fastapi import HTTPException

import generator
from course_models import QuestionList
from samples import lesson_json, mcq, questions


def lesson_json_reply() -> dict:
    return lesson_json()


def run(coro):
    return asyncio.run(coro)


def generate_goal(client, objective="Docker networking", level="beginner"):
    return client.post("/api/courses/generate", data={"mode": "goal", "level": level, "objective": objective})


def topic_request(**overrides) -> dict:
    return {"level": "beginner", "objective": "Docker", "course": "Docker", "module": "Basics", "topic": "Bridges", "summary": "About bridges", **overrides}


# --- Helpers ---

def test_dedupe_removes_repeats_ignoring_case_and_punctuation():
    from course_models import TypeAdapter, Question

    adapter = TypeAdapter(Question)
    first = adapter.validate_python({**mcq(), "q": "What is a bridge?"})
    repeat = adapter.validate_python({**mcq(), "q": "what is a BRIDGE"})
    assert generator._dedupe_questions([first, repeat], set()) == [first]


def test_dedupe_shares_the_seen_set_across_lists():
    from course_models import TypeAdapter, Question

    adapter = TypeAdapter(Question)
    one = adapter.validate_python(mcq(1))
    seen: set = set()
    generator._dedupe_questions([one], seen)
    assert generator._dedupe_questions([one], seen) == []


def test_request_cleaner_strips_control_characters_and_caps_length():
    request = generator.CourseRequest(mode="goal", level="beginner", objective="learn\x00 \x1bpython" + "x" * 1000)
    assert "\x00" not in request.objective and "\x1b" not in request.objective
    assert len(request.objective) == generator.MAX_OBJECTIVE_CHARS


def test_unknown_topic_kind_becomes_concept():
    assert generator.OutlineTopic(title="T", planet="P", kind="nonsense").kind == "concept"


# --- Asking the model ---

def test_ask_model_retries_an_unusable_answer(fake_model):
    fake_model.replies = [{"questions": questions(2)}, {"questions": questions(8)}]
    result = run(generator._ask_model(QuestionList, "system", "user"))
    assert len(result.questions) == 8
    assert len(fake_model.calls) == 2


def test_ask_model_gives_up_with_502(fake_model):
    fake_model.replies = [{"questions": []}] * generator.ATTEMPTS
    with pytest.raises(HTTPException) as error:
        run(generator._ask_model(QuestionList, "system", "user"))
    assert error.value.status_code == 502
    assert len(fake_model.calls) == generator.ATTEMPTS


# --- POST /api/courses/generate, goal mode ---

def test_goal_mode_returns_an_outline_with_module_quizzes(client, fake_model):
    response = generate_goal(client)
    assert response.status_code == 200
    course = response.json()
    assert course["source"] == "ai" and course["level"] == "beginner"
    assert course["objective"] == "Docker networking"
    assert [m["id"] for m in course["modules"]] == ["mod-1", "mod-2"]
    assert [t["id"] for t in course["modules"][0]["topics"]] == ["top-1-1", "top-1-2"]


def test_goal_mode_topics_are_not_written_yet(client, fake_model):
    topics = [t for m in generate_goal(client).json()["modules"] for t in m["topics"]]
    assert all(t["loaded"] is False and t["lesson"]["blocks"] == [] and t["quiz"] == [] for t in topics)


def test_goal_mode_modules_carry_their_own_quiz(client, fake_model):
    modules = generate_goal(client).json()["modules"]
    assert all(len(m["quiz"]) == generator.MODULE_QUIZ_SIZE for m in modules)


def test_goal_mode_makes_only_outline_and_quiz_calls(client, fake_model):
    generate_goal(client)
    lesson_calls = [c for c in fake_model.calls if "textbook author" in c]
    assert lesson_calls == []
    assert len(fake_model.calls) == 1 + 2


def test_goal_mode_course_ids_are_unique_per_request(client, fake_model):
    assert generate_goal(client).json()["id"] != generate_goal(client).json()["id"]


def test_goal_mode_rejects_a_short_objective(client, fake_model):
    assert generate_goal(client, objective="x").status_code == 422
    assert fake_model.calls == []


def test_goal_mode_rejects_an_unknown_level(client, fake_model):
    assert generate_goal(client, level="expert").status_code == 422


def test_goal_mode_passes_model_errors_through(client, fake_model):
    fake_model.replies = [HTTPException(503, "busy")]
    assert generate_goal(client).status_code == 503


# --- POST /api/courses/generate, documents mode ---

def generate_documents(client, files):
    return client.post("/api/courses/generate", data={"mode": "documents", "level": "beginner", "structure": "chapters"}, files=files)


def test_documents_mode_writes_every_topic_up_front(client, fake_model, pdf):
    response = generate_documents(client, [("files", ("bio.pdf", pdf("Plants use light"), "application/pdf"))])
    assert response.status_code == 200
    course = response.json()
    assert course["source"] == "documents"
    assert course["documents"] == [{"name": "bio.pdf", "pages": 1}]
    topic = course["modules"][0]["topics"][0]
    assert "loaded" not in topic and topic["lesson"]["blocks"] and len(topic["quiz"]) == generator.QUIZ_SIZE and len(topic["practice"]) == generator.PRACTICE_SIZE


def test_documents_mode_sends_the_document_text_to_the_model(client, fake_model, pdf):
    seen = []
    original = generator.chat_json

    async def spy(system, user):
        seen.append(user)
        return await original(system, user)

    generator.chat_json = spy
    try:
        generate_documents(client, [("files", ("bio.pdf", pdf("Chlorophyll absorbs light"), "application/pdf"))])
    finally:
        generator.chat_json = original
    assert any("Chlorophyll absorbs light" in text and "[bio.pdf p.1]" in text for text in seen)


def test_documents_mode_rejects_a_corrupt_pdf(client, fake_model):
    response = generate_documents(client, [("files", ("bad.pdf", b"nope", "application/pdf"))])
    assert response.status_code == 422
    assert fake_model.calls == []


def test_documents_mode_without_files_is_422(client, fake_model):
    assert generate_documents(client, []).status_code == 422


# --- POST /api/courses/topic ---

def test_topic_route_returns_lesson_and_questions(client, fake_model):
    response = client.post("/api/courses/topic", json=topic_request())
    assert response.status_code == 200
    body = response.json()
    assert body["lesson"]["blocks"] and body["quiz"] and body["practice"]


def test_topic_route_removes_questions_repeated_between_quiz_and_practice(client, fake_model):
    repeated = {"questions": questions(generator.QUIZ_SIZE)}
    fake_model.replies = [lesson_json_reply(), repeated, repeated]
    body = client.post("/api/courses/topic", json=topic_request()).json()
    assert len(body["quiz"]) == generator.QUIZ_SIZE and body["practice"] == []


def test_topic_route_keeps_the_def_key_on_key_terms(client, fake_model):
    blocks = client.post("/api/courses/topic", json=topic_request()).json()["lesson"]["blocks"]
    terms = next(b for b in blocks if b["type"] == "keyTerms")["terms"]
    assert terms == [{"term": "Term", "def": "Definition"}]


def test_topic_route_names_the_topic_and_module_in_the_prompt(client, fake_model):
    prompts = []
    original = generator.chat_json

    async def spy(system, user):
        prompts.append(user)
        return await original(system, user)

    generator.chat_json = spy
    try:
        client.post("/api/courses/topic", json=topic_request(topic="Overlay networks", module="Scaling"))
    finally:
        generator.chat_json = original
    assert all("Overlay networks" in p and "Scaling" in p for p in prompts)


def test_topic_route_rejects_missing_fields(client, fake_model):
    assert client.post("/api/courses/topic", json={"level": "beginner"}).status_code == 422


def test_topic_route_rejects_an_oversized_field(client, fake_model):
    assert client.post("/api/courses/topic", json=topic_request(topic="x" * 500)).status_code == 422


def test_topic_route_passes_model_errors_through(client, fake_model):
    fake_model.replies = [HTTPException(502, "bad")]
    assert client.post("/api/courses/topic", json=topic_request()).status_code == 502
