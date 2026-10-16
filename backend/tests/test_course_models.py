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


# --- Answer keys that cannot be right ---

def multi(**fields) -> dict:
    return {"type": "multi", "q": "Pick?", "options": ["a", "b", "c", "d"], "answers": [0, 1], "why": "", **fields}


def test_mcq_options_must_differ_even_in_case_and_spacing():
    with pytest.raises(ValidationError):
        question.validate_python({**mcq(), "options": ["Bridge", "bridge ", "host", "none"]})


@pytest.mark.parametrize("fields", [
    {"answers": [0, 0]},
    {"answers": [0, 1, 2, 3]},
    {"options": ["a", "A", "c", "d"]},
])
def test_multi_answers_and_options_must_be_sound(fields):
    with pytest.raises(ValidationError):
        question.validate_python(multi(**fields))


def test_a_sound_multi_question_passes():
    assert question.validate_python(multi()).answers == [0, 1]


def test_order_items_must_differ():
    with pytest.raises(ValidationError):
        question.validate_python({"type": "order", "q": "Order", "items": ["a", "b", "A"], "why": ""})


@pytest.mark.parametrize("pairs", [[["a", "x"], ["a", "y"]], [["a", "x"], ["b", "x"]]])
def test_match_sides_must_differ(pairs):
    with pytest.raises(ValidationError):
        question.validate_python({"type": "match", "q": "Match", "pairs": pairs, "why": ""})


# --- Code checks that the app can run ---

def code_with(pattern: str, solution: str = "docker network create demo") -> dict:
    return {"type": "code", "q": "Write it", "solution": solution, "checks": [{"label": "check", "pattern": pattern}], "why": ""}


@pytest.mark.parametrize("pattern", [r"network\s+create", r"\++", r"\d+\+", r"(foo|bar)+", r"a{2,3}", r"x+?", r"(?:abc)+", r"(?<=a)b"])
def test_patterns_that_mean_the_same_in_javascript_pass(pattern):
    from course_models import CodeCheck

    assert CodeCheck(label="x", pattern=pattern).pattern == pattern


@pytest.mark.parametrize("pattern", [r"(?P<name>a)", r"(?>a)", r"(?i)abc", r"(?i:abc)", r"\Afoo", r"foo\Z", r"a++", r"a*+", r"\h"])
def test_python_only_syntax_is_rejected(pattern):
    from course_models import CodeCheck

    with pytest.raises(ValidationError):
        CodeCheck(label="x", pattern=pattern)


def test_the_solution_must_pass_its_own_checks():
    with pytest.raises(ValidationError):
        question.validate_python(code_with(r"docker\s+run"))


def test_a_solution_that_passes_every_check_is_accepted():
    two = code_with(r"docker\s+network")
    two["checks"].append({"label": "second", "pattern": r"create\s+demo"})
    assert question.validate_python(two).type == "code"


def test_checks_are_tried_line_by_line_like_the_app_does():
    assert question.validate_python(code_with(r"^import os$", "import os\nprint(os.name)")).type == "code"
