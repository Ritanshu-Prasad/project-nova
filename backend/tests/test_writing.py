import asyncio

import pytest
from fastapi import HTTPException

import writing
from course_requests import CourseRequest
from planning import Outline
from samples import outline_json
from course_requests import TaughtTopic
from planning import OutlineTopic
from writing import TopicContent, keep_written, write_all_topics, write_module_quiz_from_lessons, write_topic


def request() -> CourseRequest:
    return CourseRequest(mode="goal", level="beginner", objective="Docker")


def outline(modules=2, topics=2) -> Outline:
    return Outline.model_validate(outline_json(modules, topics))


def write(outline, reports=None):
    reports = [] if reports is None else reports
    return asyncio.run(write_all_topics(outline, request(), [""] * len(outline.modules), lambda stage, detail="": reports.append((stage, detail))))


def test_every_finished_topic_is_reported(fake_model):
    reports = []
    write(outline(), reports)
    assert [detail for _, detail in reports] == [f"Writing lessons ({n} of 4)" for n in range(1, 5)]
    assert {stage for stage, _ in reports} == {"topics"}


def test_a_failed_topic_is_reported_too_and_comes_back_empty(fake_model):
    fake_model.replies = [HTTPException(502, "bad")]
    reports = []
    written = write(outline(1, 2), reports)
    assert [content is None for content in written[0]] == [True, False] or [content is None for content in written[0]] == [False, True]
    assert len(reports) == 2


def test_all_topics_keep_their_place(fake_model):
    written = write(outline(2, 3))
    assert [len(module) for module in written] == [3, 3]
    assert all(isinstance(content, TopicContent) for module in written for content in module)


def test_question_room_grows_with_the_count():
    assert writing.question_tokens(10) == 500 + 450 * 10


def test_keep_written_removes_failed_topics_and_empty_modules():
    planned = outline(3, 2)
    done = TopicContent(None, [], [])
    kept_outline, kept = keep_written(planned, [[done, None], [None, None], [done, done]])
    assert [m.title for m in kept_outline.modules] == ["Module 1", "Module 3"]
    assert [len(m.topics) for m in kept_outline.modules] == [1, 2] and [len(k) for k in kept] == [1, 2]


def test_keep_written_fails_when_nothing_was_written():
    with pytest.raises(HTTPException) as error:
        keep_written(outline(1, 2), [[None, None]])
    assert error.value.status_code == 502


# --- Topics inside a course ---

def topic_prompts(fake_model) -> list:
    return [(system, user) for system, user in fake_model.prompts if "textbook author" in system]


def write_one(outline_titles=(), previous=""):
    topic = OutlineTopic(title="Overlay", planet="Vega", summary="Across hosts")
    return asyncio.run(write_topic("Scaling", topic, request(), "", outline_titles, previous))


def test_a_topic_prompt_carries_the_outline_and_the_previous_topic(fake_model):
    write_one(["Bridges", "Overlay", "Swarm"], "Bridges isolate containers")
    [(system, user)] = topic_prompts(fake_model)
    assert "Course outline: 1. Bridges; 2. Overlay; 3. Swarm" in user and "The previous topic covered: Bridges isolate containers" in user
    assert "do not repeat what was already taught" in system


def test_a_topic_written_alone_has_no_course_rule(fake_model):
    write_one()
    [(system, user)] = topic_prompts(fake_model)
    assert "Course outline" not in user and "do not repeat" not in system


def test_document_topics_know_their_siblings_and_the_one_before(fake_model):
    write(outline(2, 2))
    users = [user for _, user in topic_prompts(fake_model)]
    assert all("Course outline: 1. Topic 1.1; 2. Topic 1.2; 3. Topic 2.1; 4. Topic 2.2" in user for user in users)
    assert sum("The previous topic covered:" in user for user in users) == 3


# --- Module quiz from the lessons ---

TAUGHT = [TaughtTopic(title="Bridges", objectives=["Explain bridges"], terms=["Veth pair"], points=["Bridges isolate"]), TaughtTopic(title="Overlay", points=["Overlay spans hosts"])]


def test_the_module_quiz_is_written_from_what_was_taught(fake_model):
    quiz = asyncio.run(write_module_quiz_from_lessons(request(), "Scaling", TAUGHT))
    assert len(quiz) == writing.MODULE_QUIZ_SIZE
    [(_, user)] = fake_model.prompts
    assert "Veth pair" in user and "Overlay spans hosts" in user and "Ask only about what was taught" in user
    assert fake_model.limits == [writing.question_tokens(writing.MODULE_QUIZ_SIZE)]


def test_a_module_quiz_that_cannot_be_written_is_an_error(fake_model):
    fake_model.replies = [HTTPException(503, "busy")]
    with pytest.raises(HTTPException):
        asyncio.run(write_module_quiz_from_lessons(request(), "Scaling", TAUGHT))
