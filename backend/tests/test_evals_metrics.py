import pytest
from pydantic import TypeAdapter, ValidationError

from course_models import Question
from evals.judge import JUDGE_PROMPT, Scores, judge_lesson
from evals.metrics import citation_survival, duplicate_rate, level_gap, reading_grade, retry_rate, type_mix
from samples import mcq

parse = TypeAdapter(Question).validate_python

SIMPLE = "The cat sat on the mat. The dog ran in the sun. We like to play."
HARD = "Quantization-aware optimization necessitates comprehensive reconsideration of gradient propagation characteristics throughout heterogeneous computational architectures."


# --- Reading grade ---

def test_simple_text_reads_at_a_lower_grade_than_dense_text():
    assert reading_grade(SIMPLE) < reading_grade(HARD)


def test_a_simple_text_is_at_a_low_grade():
    assert reading_grade(SIMPLE) < 4


def test_an_empty_text_has_no_grade():
    assert reading_grade("") == 0.0 and reading_grade("...") == 0.0


def test_a_text_without_a_full_stop_is_one_sentence():
    assert reading_grade("many words in one long run on sentence without an end") > 0


def test_the_gap_is_positive_when_the_second_text_is_harder():
    assert level_gap(SIMPLE, HARD) > 5 and level_gap(HARD, SIMPLE) < -5


# --- Questions ---

def test_duplicate_questions_are_counted_ignoring_case_and_punctuation():
    questions = [parse({**mcq(), "q": "What is a bridge?"}), parse({**mcq(), "q": "what is a BRIDGE"}), parse({**mcq(), "q": "Name the default driver"}), parse({**mcq(), "q": "Another one"})]
    assert duplicate_rate(questions) == 0.25


def test_no_questions_have_no_duplicates():
    assert duplicate_rate([]) == 0.0


def test_the_mix_of_question_types_is_counted_and_sorted():
    questions = [parse(mcq(1)), parse({"type": "truefalse", "q": "True?", "answer": True, "why": ""}), parse(mcq(2))]
    assert type_mix(questions) == {"mcq": 2, "truefalse": 1}


# --- Runs ---

def test_the_retry_rate_is_retries_per_call():
    assert retry_rate(calls=10, retries=3) == 0.3 and retry_rate(0, 0) == 0.0


def test_citation_survival_is_the_share_of_quotes_that_were_real():
    assert citation_survival(10, 8) == 0.8 and citation_survival(0, 0) == 1.0


# --- The reviewer ---

def test_scores_are_averaged():
    assert Scores(accuracy=4, clarity=5, level_fit=3, alignment=4).average == 4.0


@pytest.mark.parametrize("field", ["accuracy", "clarity", "level_fit", "alignment"])
def test_scores_must_be_between_one_and_five(field):
    fields = {"accuracy": 3, "clarity": 3, "level_fit": 3, "alignment": 3, field: 6}
    with pytest.raises(ValidationError):
        Scores(**fields)


def test_a_lesson_is_reviewed_with_its_goal_level_and_objectives(fake_model):
    import asyncio

    scores = asyncio.run(judge_lesson("Docker", "advanced", ["Explain bridges", "Compare drivers"], "Lesson text here"))
    system, user = fake_model.prompts[0]
    assert system == JUDGE_PROMPT and "Goal: Docker" in user and "Level: advanced" in user
    assert "Explain bridges; Compare drivers" in user and "Lesson text here" in user and scores.average == 4.5


def test_a_very_long_lesson_is_cut_for_the_reviewer(fake_model):
    import asyncio

    asyncio.run(judge_lesson("Docker", "advanced", [], "x" * 20000))
    assert len(fake_model.prompts[0][1]) < 7000
