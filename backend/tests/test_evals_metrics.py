from pydantic import TypeAdapter

from course_models import Question
from evals.metrics import citation_survival, duplicate_rate, length_ratio, reading_grade, repeated_extras, retry_rate, sections_with_lists, type_mix
from module_content import ModuleContent, Section
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


# --- Modules and outlines ---

EXAMPLE = "A worked example with concrete numbers, such as three apples and two pears."


def unchecked(*extras_per_section):
    """A module whose sections carry the named extras, built without the validators that would drop repeats."""
    sections = [Section.model_construct(**{name: "text" for name in kinds}) for kinds in extras_per_section]
    return ModuleContent.model_construct(sections=sections)


def test_neighbouring_sections_sharing_an_extra_are_counted():
    assert repeated_extras(unchecked(["example"], ["example", "quick_check"], ["analogy"])) == 1


def test_sections_that_share_an_extra_but_are_not_neighbours_are_not_counted():
    assert repeated_extras(unchecked(["example"], ["analogy"], ["example"])) == 0


def test_a_module_with_no_extras_has_no_repeats():
    assert repeated_extras(unchecked([], [], [])) == 0


def listed(*explanations):
    sections = [Section.model_construct(explanation=text) for text in explanations]
    return ModuleContent.model_construct(sections=sections)


def test_sections_with_a_markdown_list_are_counted():
    prose = "One sentence of prose."
    ordered, bullets = f"{prose}\n1. First step.\n2. Second step.", f"{prose}\n- A point.\n  - A sub-point."
    assert sections_with_lists(listed(prose, ordered, bullets)) == 2
    assert sections_with_lists(listed(prose, "A dash - inside a sentence, and 3. not a list.")) == 0


def test_sections_with_points_are_counted_as_lists_too():
    sections = [Section.model_construct(explanation="Prose only.", points=["A", "B", "C"]), Section.model_construct(explanation="Prose only.", points=None), Section.model_construct(explanation="Prose.\n- A point.", points=None)]
    assert sections_with_lists(ModuleContent.model_construct(sections=sections)) == 2
