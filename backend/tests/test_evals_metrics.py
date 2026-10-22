import pytest
from pydantic import TypeAdapter, ValidationError

from course_models import Question
from evals.judge import JUDGE_PROMPT, QUESTION_PROMPT, QuestionScores, Scores, answered_off_topic, judge_lesson, judge_questions
from evals.metrics import citation_survival, duplicate_rate, first_try_rate, fraction, length_ratio, percentile, precision_recall, reading_grade, retry_rate, type_mix
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


def test_the_length_ratio_says_how_many_times_longer_the_second_text_is():
    assert length_ratio("one two", "one two three four five six") == 3.0 and length_ratio("", "a b") == 2.0


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
    assert Scores(accuracy=4, clarity=5, scope_fit=3, alignment=4).average == 4.0


@pytest.mark.parametrize("field", ["accuracy", "clarity", "scope_fit", "alignment"])
def test_scores_must_be_between_one_and_five(field):
    fields = {"accuracy": 3, "clarity": 3, "scope_fit": 3, "alignment": 3, field: 6}
    with pytest.raises(ValidationError):
        Scores(**fields)


def test_a_lesson_is_reviewed_with_its_goal_expectations_and_objectives(fake_model):
    import asyncio

    scores = asyncio.run(judge_lesson("Docker", "advanced", ["Explain bridges", "Compare drivers"], "Lesson text here"))
    system, user = fake_model.prompts[0]
    assert system == JUDGE_PROMPT and "Goal: Docker" in user and "Learner expectations: advanced" in user
    assert "Explain bridges; Compare drivers" in user and "Lesson text here" in user and scores.average == 4.5


def test_a_very_long_lesson_is_cut_for_the_reviewer(fake_model):
    import asyncio

    asyncio.run(judge_lesson("Docker", "advanced", [], "x" * 20000))
    assert len(fake_model.prompts[0][1]) < 7000


# --- First try, percentiles, fractions ---

def test_the_first_try_rate_falls_with_retries():
    assert first_try_rate(10, 0) == 1.0 and first_try_rate(10, 3) == 0.7 and first_try_rate(10, 20) == 0.0


def test_without_calls_the_first_try_rate_is_perfect():
    assert first_try_rate(0, 0) == 1.0


def test_percentiles_use_the_nearest_rank():
    values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    assert (percentile(values, 50), percentile(values, 95), percentile(values, 100)) == (5, 10, 10)


def test_a_percentile_does_not_depend_on_the_order():
    assert percentile([9, 1, 5], 50) == 5 and percentile([7], 95) == 7


def test_no_values_have_no_percentile():
    assert percentile([], 50) is None


def test_a_fraction_is_the_share_of_items_that_match():
    assert fraction([1, 2, 3, 4], lambda n: n % 2 == 0) == 0.5 and fraction([], bool) is None


def test_precision_and_recall():
    expected = [True, True, True, False, False]
    predicted = [True, True, False, True, False]
    assert precision_recall(expected, predicted) == (2 / 3, 2 / 3)


def test_precision_is_unknown_when_nothing_was_flagged_and_recall_when_nothing_was_wanted():
    assert precision_recall([True, False], [False, False]) == (None, 0.0)
    assert precision_recall([False, False], [True, False]) == (0.0, None)


# --- More reviewers ---

def test_question_scores_are_averaged_and_limited():
    assert QuestionScores(clarity=4, key_correct=5, difficulty_fit=3).average == 4.0
    with pytest.raises(ValidationError):
        QuestionScores(clarity=0, key_correct=5, difficulty_fit=3)


def test_questions_are_reviewed_with_goal_level_and_a_numbered_list(fake_model):
    import asyncio

    scores = asyncio.run(judge_questions("Docker", "advanced", ["What is a bridge?", "What is overlay?"]))
    system, user = fake_model.prompts[0]
    assert system == QUESTION_PROMPT and "Goal: Docker" in user and "1. What is a bridge?" in user and "2. What is overlay?" in user
    assert scores.average == pytest.approx(13 / 3)


def test_only_the_first_twelve_questions_are_reviewed(fake_model):
    import asyncio

    asyncio.run(judge_questions("Docker", "advanced", [f"Question {n}" for n in range(30)]))
    assert "12. Question 11" in fake_model.prompts[0][1] and "Question 12" not in fake_model.prompts[0][1]


def test_an_off_topic_answer_is_detected(fake_model):
    import asyncio

    fake_model.replies = [{"answered": True}]
    assert asyncio.run(answered_off_topic("Write a poem", "Roses are red")) is True
    assert asyncio.run(answered_off_topic("Write a poem", "I can only help with this lesson")) is False
