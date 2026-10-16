import pytest
from pydantic import TypeAdapter, ValidationError

from course_models import Blocks, Lesson, Question, QuestionList, Questions, Term
from samples import mcq, questions

question = TypeAdapter(Question)


# --- Single questions ---

def test_mcq_answer_must_be_one_of_the_options():
    with pytest.raises(ValidationError):
        question.validate_python({**mcq(), "answer": 4})


def test_multi_answers_must_be_one_of_the_options():
    bad = {"type": "multi", "q": "Pick?", "options": ["a", "b"], "answers": [0, 2], "why": ""}
    with pytest.raises(ValidationError):
        question.validate_python(bad)


def code_question(pattern: str) -> dict:
    return {"type": "code", "q": "Write it", "solution": "x = 1", "checks": [{"label": "assigns", "pattern": pattern}], "why": ""}


def test_code_question_accepts_a_valid_pattern():
    assert question.validate_python(code_question(r"x\s*=\s*1")).type == "code"


def test_code_question_rejects_an_invalid_pattern():
    with pytest.raises(ValidationError):
        question.validate_python(code_question("(unclosed"))


def test_order_needs_three_items():
    with pytest.raises(ValidationError):
        question.validate_python({"type": "order", "q": "Order", "items": ["a", "b"], "why": ""})


def test_match_needs_two_pairs():
    with pytest.raises(ValidationError):
        question.validate_python({"type": "match", "q": "Match", "pairs": [["a", "b"]], "why": ""})


def test_difficulty_must_be_between_one_and_three():
    with pytest.raises(ValidationError):
        question.validate_python({**mcq(), "difficulty": 5})


# --- Lenient lists ---

def test_questions_drop_invalid_items_and_keep_the_rest():
    adapter = TypeAdapter(Questions)
    kept = adapter.validate_python([mcq(1), {"type": "mcq", "q": "bad"}, {"type": "unknown"}, mcq(2)])
    assert [q.q for q in kept] == ["Question number 1?", "Question number 2?"]


def test_questions_treat_a_non_list_as_empty():
    assert TypeAdapter(Questions).validate_python("nope") == []


def test_blocks_drop_unknown_and_empty_blocks():
    blocks = TypeAdapter(Blocks).validate_python([{"type": "text", "body": "ok"}, {"type": "text", "body": ""}, {"type": "mystery"}])
    assert len(blocks) == 1


# --- Lesson and question lists ---

def test_lesson_needs_at_least_one_valid_block():
    with pytest.raises(ValidationError):
        Lesson.model_validate({"blocks": [{"type": "text", "body": ""}]})


def test_question_list_needs_enough_valid_questions():
    with pytest.raises(ValidationError):
        QuestionList.model_validate({"questions": questions(5)})
    assert len(QuestionList.model_validate({"questions": questions(6)}).questions) == 6


def test_term_reads_the_def_key():
    assert Term.model_validate({"term": "Cat", "def": "An animal"}).definition == "An animal"
