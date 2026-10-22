import asyncio

import pytest
from fastapi import HTTPException

import writing
from course_requests import CourseRequest
from planning import Outline
from samples import outline_json
from planning import OutlineTopic
from question_bank import QuestionBank
from samples import bank_batch_json
from writing import TopicContent, keep_written, module_quiz, write_all_topics, write_topic


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
    return [(system, user) for system, user in fake_model.prompts if "expert curriculum designer and teacher" in system]


def write_one(outline_titles=(), previous=""):
    topic = OutlineTopic(title="Overlay", planet="Vega", summary="Across hosts")
    return asyncio.run(write_topic("Scaling", topic, request(), "", outline_titles, previous))


def test_a_topic_prompt_carries_the_outline_and_the_previous_topic(fake_model):
    write_one(["Bridges", "Overlay", "Swarm"], "Bridges isolate containers")
    [(system, user)] = topic_prompts(fake_model)
    assert "Course outline: Bridges; Overlay; Swarm." in user and "The previous topic covered: Bridges isolate containers" in user
    assert "do not repeat what they taught" in system


def test_a_topic_written_alone_has_no_outline_or_previous_topic(fake_model):
    write_one()
    [(_, user)] = topic_prompts(fake_model)
    assert "Course outline" not in user and "previous topic" not in user


def test_topics_know_their_siblings_and_the_one_before(fake_model):
    write(outline(2, 2))
    users = [user for _, user in topic_prompts(fake_model)]
    assert all("Course outline: Topic 1.1; Topic 1.2; Topic 2.1; Topic 2.2." in user for user in users)
    assert sum("The previous topic covered:" in user for user in users) == 3


def test_a_topic_comes_with_a_lesson_and_a_bank_split_into_quiz_and_practice(fake_model):
    content = write_one()
    assert content.lesson.blocks and len(content.quiz) == 4 and len(content.practice) == 4
    assert len({q.q for q in content.quiz + content.practice}) == 8


def test_the_bank_of_a_topic_is_kept_for_the_module_quiz(fake_model):
    from cache import BANKS

    write_one()
    stored = asyncio.run(BANKS.get(writing.bank_key("Docker", "Scaling", "Overlay")))
    assert len(stored["questions"]) == 8


def test_a_topic_whose_bank_cannot_be_made_reliable_fails(fake_model, monkeypatch):
    async def never(content, first_pass=None):
        raise HTTPException(502, "no bank")

    monkeypatch.setattr(writing, "write_bank", never)
    with pytest.raises(HTTPException):
        write_one()


# --- The end-of-module quiz ---

def bank(tag: str) -> dict:
    """A stored bank whose question stems carry `tag`, so banks of different topics are told apart."""
    user = "Write exactly 4 questions of type mcq, the first from section 0, then section 1, then section 2, then section 0."
    questions = bank_batch_json(user)["questions"]
    for number, question in enumerate(questions):
        question["question_text"] = f"{tag} question {number}?"
    others = bank_batch_json("Write exactly 2 questions of type msq, the first from section 1, then section 2.")["questions"] + bank_batch_json("Write exactly 2 questions of type true_false, the first from section 0, then section 1.")["questions"]
    for number, question in enumerate(others):
        question["question_text"] = f"{tag} other {number}" + ("? Select all that apply." if question["type"] == "msq" else ".")
    return QuestionBank.model_validate({"questions": questions + others}).model_dump()


def test_the_module_quiz_takes_questions_from_every_topic_in_turn():
    quiz = asyncio.run(module_quiz([bank("alpha"), bank("beta")]))
    assert len(quiz) == writing.MODULE_QUIZ_SIZE
    assert {q.q.split()[0] for q in quiz} == {"alpha", "beta"}


def test_the_module_quiz_never_repeats_a_question_and_can_be_shorter_than_asked():
    quiz = asyncio.run(module_quiz([bank("alpha")], size=20))
    assert len(quiz) == 8 and len({q.q for q in quiz}) == 8


def test_the_module_quiz_changes_between_draws():
    draws = {tuple(q.q for q in asyncio.run(module_quiz([bank("alpha"), bank("beta")]))) for _ in range(10)}
    assert len(draws) > 1


def test_the_module_quiz_with_no_banks_is_empty():
    assert asyncio.run(module_quiz([])) == []
