import asyncio

import pytest
from fastapi import HTTPException

import writing
from course_requests import CourseRequest
from planning import Outline
from samples import outline_json
from writing import TopicContent, keep_written, write_all_topics


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
