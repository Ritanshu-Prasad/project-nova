import asyncio

import pytest
from fastapi import HTTPException
from pydantic import TypeAdapter

import writing
from answer_check import drop_disputed
from course_models import Question
from course_requests import CourseRequest
from planning import OutlineTopic
from samples import lesson_json, questions

parse = TypeAdapter(Question).validate_python


@pytest.fixture(autouse=True)
def checking_on(monkeypatch):
    monkeypatch.delenv("NOVA_VERIFY_ANSWERS", raising=False)


def run(coro):
    return asyncio.run(coro)


def twice(reply: dict) -> list:
    """Both votes give the same answers."""
    return [reply, reply]


def quiz(count=8) -> list:
    return [parse(item) for item in questions(count)]


def answers(*choices) -> dict:
    return {"answers": [{"number": number, "choice": choice} for number, choice in enumerate(choices, start=1)]}


KEY = [1]


def test_questions_the_model_agrees_with_are_all_kept(fake_model):
    fake_model.replies = twice(answers(*[KEY] * 8))
    assert len(run(drop_disputed(quiz(), "beginner"))) == 8


def test_a_question_the_model_answers_differently_is_dropped(fake_model):
    fake_model.replies = twice(answers(KEY, KEY, [0], KEY, KEY, KEY, KEY, KEY))
    kept = run(drop_disputed(quiz(), "beginner"))
    assert len(kept) == 7 and "Question number 2?" not in [q.q for q in kept]


def test_nothing_is_dropped_if_too_few_questions_would_remain(fake_model):
    original = quiz()
    fake_model.replies = twice(answers(*[[0]] * 8))
    assert run(drop_disputed(original, "beginner")) == original


def test_a_failing_check_leaves_the_questions_alone(fake_model):
    original = quiz()
    fake_model.replies = [HTTPException(503, "busy")] * 2
    assert run(drop_disputed(original, "beginner")) == original


def test_an_unanswered_question_is_not_counted_as_wrong(fake_model):
    fake_model.replies = twice({"answers": [{"number": 1, "choice": KEY}]})
    assert len(run(drop_disputed(quiz(), "beginner"))) == 8


def test_true_false_and_select_all_questions_are_compared_with_their_keys(fake_model):
    mixed = [
        parse({"type": "truefalse", "q": "Is it true?", "answer": True, "why": ""}),
        parse({"type": "truefalse", "q": "Is it false?", "answer": False, "why": ""}),
        parse({"type": "multi", "q": "Pick the right ones", "options": ["a", "b", "c", "d"], "answers": [0, 2], "why": ""}),
    ] + quiz(5)
    fake_model.replies = twice(answers([0], [1], [0, 2], *[KEY] * 5))
    assert len(run(drop_disputed(mixed, "beginner"))) == 8
    fake_model.replies = twice(answers([1], [1], [0, 2], *[KEY] * 5))
    assert len(run(drop_disputed(mixed, "beginner"))) == 7


def test_questions_without_a_choice_key_are_not_sent(fake_model):
    others = [
        parse({"type": "fill", "q": "The ____ driver", "answer": "bridge", "why": ""}),
        parse({"type": "order", "q": "Order these", "items": ["a", "b", "c"], "why": ""}),
    ]
    fake_model.replies = twice(answers(*[KEY] * 6))
    run(drop_disputed(others + quiz(6), "beginner"))
    sent = fake_model.prompts[0][1]
    assert "Question 6" in sent and "Question 7" not in sent and "The ____ driver" not in sent


def test_nothing_is_asked_when_no_question_can_be_checked(fake_model):
    original = [parse({"type": "fill", "q": f"Gap {n} ____", "answer": "x", "why": ""}) for n in range(6)]
    assert run(drop_disputed(original, "beginner")) == original and fake_model.calls == []


def test_the_model_never_sees_the_key_or_the_explanation(fake_model):
    fake_model.replies = twice(answers(*[KEY] * 8))
    run(drop_disputed(quiz(), "beginner"))
    assert "Because." not in fake_model.prompts[0][1] and "answer" not in fake_model.prompts[0][1].lower().replace("answers", "")


def test_document_excerpts_are_given_to_the_model(fake_model, monkeypatch):
    monkeypatch.setenv("NOVA_VERIFY_DOCUMENTS", "on")
    fake_model.replies = twice(answers(*[KEY] * 8))
    run(drop_disputed(quiz(), "beginner", context="[a.pdf p.1]\nBridges connect containers."))
    assert "Bridges connect containers." in fake_model.prompts[0][1]


def test_it_can_be_switched_off(fake_model, monkeypatch):
    monkeypatch.setenv("NOVA_VERIFY_ANSWERS", "off")
    original = quiz()
    assert run(drop_disputed(original, "beginner")) == original and fake_model.calls == []


# --- In writing a topic ---

def write(fake_model, blind):
    fake_model.replies = [lesson_json(), {"questions": questions(8)}, {"questions": questions(12, start=100)}, blind, blind]
    topic = OutlineTopic(title="Bridges", planet="Vega")
    return run(writing.write_topic("Basics", topic, CourseRequest(mode="goal", level="beginner", objective="Docker"), context=""))


def test_the_graded_quiz_is_checked_when_a_topic_is_written(fake_model):
    content = write(fake_model, answers(KEY, [0], *[KEY] * 6))
    assert len(content.quiz) == 7 and len(content.practice) == 12


def test_practice_questions_are_not_checked(fake_model):
    write(fake_model, answers(*[KEY] * 8))
    assert len(fake_model.calls) == 5


# --- Two votes, quick answers ---

def test_one_vote_that_agrees_with_the_key_saves_the_question(fake_model):
    fake_model.replies = [answers(KEY, [0], *[KEY] * 6), answers(*[KEY] * 8)]
    assert len(run(drop_disputed(quiz(), "beginner"))) == 8


def test_both_votes_disagreeing_drops_the_question(fake_model):
    fake_model.replies = [answers(KEY, [0], *[KEY] * 6), answers(KEY, [2], *[KEY] * 6)]
    assert len(run(drop_disputed(quiz(), "beginner"))) == 7


def test_the_votes_are_asked_without_thinking_and_with_a_small_budget(fake_model):
    fake_model.replies = twice(answers(*[KEY] * 8))
    run(drop_disputed(quiz(), "beginner"))
    assert fake_model.thinking == [False, False] and max(fake_model.limits) < 1000


def test_a_vote_that_does_not_answer_a_question_never_disputes_it(fake_model):
    fake_model.replies = [answers(KEY, [0], *[KEY] * 6), {"answers": [{"number": 1, "choice": KEY}]}]
    assert len(run(drop_disputed(quiz(), "beginner"))) == 8


def test_questions_from_documents_are_not_checked_unless_asked(fake_model):
    original = quiz()
    assert run(drop_disputed(original, "beginner", context="[a.pdf p.1]\ntext")) == original
    assert fake_model.calls == []
