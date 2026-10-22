import random

import pytest

import course_models as course
from course_adapter import to_lesson, to_question
from module_content import ModuleContent
from question_bank import QuestionBank, pick_from
from samples import EVIDENCE, bank_batch_json, module_content_json


def written(**changes) -> ModuleContent:
    return ModuleContent.model_validate({**module_content_json(), **changes})


def bank_questions() -> list:
    batches = [
        bank_batch_json("Write exactly 4 questions of type mcq, the first from section 0, then section 1, then section 2, then section 0."),
        bank_batch_json("Write exactly 2 questions of type msq, the first from section 1, then section 2."),
        bank_batch_json("Write exactly 2 questions of type true_false, the first from section 0, then section 1."),
    ]
    questions = [q for batch in batches for q in batch["questions"]]
    for n, question in enumerate(questions, 1):
        question["question_id"] = f"q{n}"
        question["question_text"] = f"{question['type']} {n}: " + question["question_text"]
    return QuestionBank.model_validate({"questions": questions}).questions


# --- Lesson ---

def test_each_section_becomes_a_text_block_and_the_lesson_ends_with_a_summary_of_the_headings():
    lesson = to_lesson(written())
    texts = [block for block in lesson.blocks if block.type == "text"]
    assert [block.title for block in texts] == ["Idea 0", "Idea 1", "Idea 2"] and EVIDENCE in texts[0].body
    assert lesson.blocks[-1].type == "summary" and lesson.blocks[-1].points == ["Idea 0", "Idea 1", "Idea 2"]


def test_the_key_terms_come_after_the_first_section_and_keep_their_def_key():
    lesson = to_lesson(written())
    assert [block.type for block in lesson.blocks][:2] == ["text", "keyTerms"]
    assert lesson.model_dump(by_alias=True)["blocks"][1]["terms"][0] == {"term": "Term 0", "def": "A short definition of the term."}


def test_analogies_steps_and_code_become_their_own_blocks():
    data = module_content_json(requires_code=True)
    data["sections"][0].update(analogy="It is like watering a plant.", action_steps=["Pick one habit", "Do it daily"])
    lesson = to_lesson(ModuleContent.model_validate(data))
    kinds = [block.type for block in lesson.blocks]
    assert kinds[:4] == ["text", "analogy", "steps", "keyTerms"] and "code" in kinds
    code = next(block for block in lesson.blocks if block.type == "code")
    assert code.language == "python" and code.code == "print('hi')" and code.caption == "Prints a greeting to the screen."


def test_a_module_without_code_gives_a_lesson_without_code_blocks():
    assert all(block.type != "code" for block in to_lesson(written()).blocks)


def test_the_overview_is_the_short_version_and_the_objectives_are_the_modules_own_sentences():
    lesson = to_lesson(written())
    assert lesson.simple.startswith("How small, repeated actions")
    assert lesson.objectives == ["Explain how a small action attaches to a routine", "Build a habit that needs little willpower"]


def test_the_time_counts_reading_tasks_code_and_questions():
    plain = to_lesson(written()).minutes
    with_steps = module_content_json()
    with_steps["sections"][0]["action_steps"] = ["Pick one habit", "Do it daily"]
    with_code = module_content_json(requires_code=True)
    assert plain == 5 and to_lesson(ModuleContent.model_validate(with_steps)).minutes == plain + 2
    assert to_lesson(ModuleContent.model_validate(with_code)).minutes == plain + 2


def test_a_longer_lesson_takes_longer():
    long = module_content_json(sections=8)
    for section in long["sections"]:
        section["explanation"] = section["explanation"] * 6
    assert to_lesson(ModuleContent.model_validate(long)).minutes > 10


def test_examples_mistakes_and_quick_checks_become_blocks_in_that_order():
    data = module_content_json()
    data["sections"][0].update(example="Rent is 12000 of a 30000 income, so 40 percent goes to housing.", common_mistake="Counting a bonus as regular income and spending it all.", quick_check={"question": "What share is 12000 of 30000?", "answer": "40 percent"})
    data["sections"][1].update(analogy="It is like watering a plant.")
    blocks = to_lesson(ModuleContent.model_validate(data)).blocks
    assert [block.type for block in blocks][:5] == ["text", "example", "callout", "keyTerms", "text"]
    assert blocks[1].title == "Worked example" and blocks[2].tone == "warning" and blocks[2].body.startswith("Common mistake:")


def test_a_quick_check_shows_its_answer():
    data = module_content_json()
    data["sections"][0].update(quick_check={"question": "What share is 12000 of 30000?", "answer": "40 percent"})
    data["sections"][0]["analogy"] = "It is like watering a plant."
    blocks = to_lesson(ModuleContent.model_validate(data)).blocks
    check = next(block for block in blocks if block.type == "callout")
    assert check.tone == "tip" and "Quick check: What share is 12000 of 30000? Answer: 40 percent" == check.body


def test_the_lesson_is_accepted_by_the_course_model():
    assert isinstance(to_lesson(written()), course.Lesson)


# --- Questions ---

def by_type(questions, kind):
    return next(q for q in questions if q.type == kind)


def test_single_choice_keeps_its_options_and_points_at_the_right_one():
    question = by_type(bank_questions(), "mcq")
    shaped = to_question(question)
    assert shaped.type == "mcq" and shaped.options == [option.text for option in question.options]
    assert shaped.options[shaped.answer] == next(option.text for option in question.options if option.id == question.correct_answer)
    assert shaped.why == question.explanation


def test_multiple_select_points_at_every_correct_option():
    question = by_type(bank_questions(), "msq")
    shaped = to_question(question)
    assert shaped.type == "multi" and shaped.answers == [0, 2]


def test_true_false_keeps_its_answer():
    question = by_type(bank_questions(), "true_false")
    shaped = to_question(question)
    assert shaped.type == "truefalse" and shaped.answer == question.correct_answer


def test_an_ordering_question_keeps_its_items_in_the_correct_order():
    data = bank_batch_json("Write exactly 8 questions of type order, the first from section 0, then section 1, then section 2, then section 0, then section 1, then section 2, then section 0, then section 1.")["questions"]
    shaped = to_question(QuestionBank.model_validate({"questions": [{**q, "question_text": f"Put these steps in the correct order: habit {n}"} for n, q in enumerate(data)]}).questions[0])
    assert shaped.type == "order" and shaped.items[0] == "Choose one tiny action"


@pytest.mark.parametrize("seed", range(10))
def test_shuffled_options_still_point_at_the_right_text(seed):
    questions = bank_questions()
    for picked in pick_from(questions, 8, random.Random(seed)):
        original = next(q for q in questions if q.question_id == picked.question_id)
        shaped = to_question(picked)
        if picked.type == "mcq":
            right = next(option.text for option in original.options if option.id == original.correct_answer)
            assert shaped.options[shaped.answer] == right
        if picked.type == "msq":
            right = {option.text for option in original.options if option.id in original.correct_answer}
            assert {shaped.options[index] for index in shaped.answers} == right


def test_every_shaped_question_is_accepted_by_the_course_model():
    shaped = [to_question(q) for q in bank_questions()]
    assert all(isinstance(q, (course.Mcq, course.Multi, course.TrueFalse, course.Order)) for q in shaped)
    assert course.QuestionList(questions=shaped).questions == shaped
