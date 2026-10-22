import asyncio
import random
import re

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import llm
import usage
from module_content import ModuleContent
from question_bank import TYPE_RULES, QuestionBank, bank_system, bank_user, check_bank, pick_quiz, plan_sections, plan_types, with_found_sections, wording_problem, write_bank
from test_module_content import module, section

STEPS = ["Choose one tiny action", "Attach it to a daily routine", "Do it right after the routine", "Celebrate right away"]


def content(sequence=False, sections=3) -> ModuleContent:
    items = [section(f"Idea {n}") for n in range(sections)]
    if sequence:
        items[0] = section("Idea 0", action_steps=STEPS)
    return ModuleContent.model_validate(module(sections=items))


def quote() -> str:
    return "a small action is tied to something that already happens every day"


def options(count, text="Option"):
    return [{"id": "abcdef"[i], "text": f"{text} {i} about the idea"} for i in range(count)]


def mcq(n, section_index=0, answer="a", stem="Which habit idea is described?"):
    return {"question_id": f"q{n}", "type": "mcq", "question_text": f"{stem} (variant {n})", "options": options(4, f"Choice {n}"), "correct_answer": answer,
            "explanation": "A small action is easier to repeat when it follows a routine.", "evidence": quote(), "section_index": section_index}


def msq(n, section_index=1):
    return {**mcq(n, section_index), "type": "msq", "question_text": f"Which of these are true about habits {n}? Select all that apply.",
            "options": options(5, f"Pick {n}"), "correct_answer": ["a", "c"]}


def true_false(n, section_index=2, answer=True):
    return {"question_id": f"q{n}", "type": "true_false", "question_text": f"A small action tied to a daily routine becomes easier to repeat {n}.", "correct_answer": answer,
            "explanation": "A small action is easier to repeat when it follows a routine.", "evidence": quote(), "section_index": section_index}


def order(n, section_index=0, items=None):
    return {"question_id": f"q{n}", "type": "order", "question_text": "Put these steps in the correct order: building a habit", "items": items or STEPS,
            "explanation": "The steps come in this order.", "evidence": quote(), "section_index": section_index}


def bank(*questions):
    return QuestionBank.model_validate({"questions": list(questions)})


def good_questions():
    """Eight questions in the order and sections plan_types and plan_sections give a three-section module."""
    return [mcq(1, 0, "a"), mcq(2, 1, "b"), mcq(3, 2, "c"), mcq(4, 0, "d"), msq(5, 1), msq(6, 2), true_false(7, 0), true_false(8, 1, False)]


def check(questions, module_content=None):
    module_content = module_content or content()
    plan = [question["type"] for question in questions]
    return check_bank(bank(*questions), module_content, plan, plan_sections(module_content, plan))


# --- The plan ---

def test_the_plan_has_between_eight_and_ten_questions_and_fixed_types():
    short, long = plan_types(content(sections=3)), plan_types(content(sections=8))
    assert len(short) == 8 and len(long) == 10
    assert short.count("msq") == 2 and short.count("true_false") == 2 and "order" not in short


def test_an_ordering_question_is_planned_only_when_the_module_teaches_a_sequence():
    assert "order" in plan_types(content(sequence=True)) and "order" not in plan_types(content(sequence=False))


def test_questions_are_spread_over_every_section():
    module_content = content(sections=4)
    assert set(plan_sections(module_content, plan_types(module_content))) == {0, 1, 2, 3}


# --- Wording must fit the type ---

@pytest.mark.parametrize("stem", ["Which of the following is a habit anchor?", "What does a habit anchor do?", "Is a small action easier to repeat?", "A small action is easier to repeat, true or false?"])
def test_a_question_written_as_a_question_cannot_be_true_false(stem):
    question = bank(*good_questions()[:7], {**true_false(8), "question_text": stem}).questions[-1]
    assert wording_problem(question)


def test_a_plain_statement_is_a_valid_true_false():
    assert wording_problem(bank(*good_questions()).questions[6]) is None


@pytest.mark.parametrize("stem", ["Put these steps in the correct order: which comes first?", "Arrange the ideas. Which is first?", "Select all that apply: which are habits?", "True or false: habits form fast."])
def test_a_single_choice_stem_cannot_ask_to_order_select_several_or_answer_true_false(stem):
    question = bank({**mcq(1), "question_text": stem}, *good_questions()[1:]).questions[0]
    assert wording_problem(question)


def test_a_multiple_select_stem_must_say_select_all_that_apply():
    question = bank(*good_questions()[:4], {**msq(5), "question_text": "Which of these are true about habits?"}, *good_questions()[5:]).questions[4]
    assert "select all" in wording_problem(question)


def test_catch_all_options_are_refused():
    bad = {**mcq(1), "options": options(3) + [{"id": "d", "text": "All of the above"}]}
    assert "catch-all" in wording_problem(bank(bad, *good_questions()[1:]).questions[0])


def test_an_order_question_must_ask_to_put_or_arrange_items():
    bad = {**order(9), "question_text": "Which step comes first in building a habit?"}
    assert "ordering" in wording_problem(bank(*good_questions()[:7], bad).questions[-1])


# --- Shapes ---

def test_a_single_choice_question_needs_exactly_four_distinct_options_and_a_real_answer():
    for bad in [{**mcq(1), "options": options(3)}, {**mcq(1), "correct_answer": "e"}, {**mcq(1), "options": [{"id": "a", "text": "Same"}] * 4}]:
        with pytest.raises(ValidationError):
            bank(bad, *good_questions()[1:])


def test_options_that_differ_only_by_a_symbol_are_different_options():
    code_options = [{"id": "abcd"[i], "text": text} for i, text in enumerate(["[x*2 for x in a]", "[x+2 for x in a]", "[x-2 for x in a]", "[x/2 for x in a]"])]
    bank({**mcq(1), "options": code_options}, *good_questions()[1:])


def test_a_multiple_select_question_needs_two_or_three_correct_answers():
    for answers in (["a"], ["a", "b", "c", "d"], ["a", "a"]):
        with pytest.raises(ValidationError):
            bank(*good_questions()[:4], {**msq(5), "correct_answer": answers}, *good_questions()[5:])


def test_an_order_question_needs_four_to_six_distinct_items():
    for items in (STEPS[:3], STEPS + STEPS[:3], [STEPS[0]] * 4):
        with pytest.raises(ValidationError):
            bank(*good_questions()[:7], order(9, items=items))


def test_a_bank_has_six_to_ten_questions():
    with pytest.raises(ValidationError):
        bank(*good_questions()[:5])
    assert len(bank(*good_questions()[:6]).questions) == 6


# --- Whole-bank checks ---

def test_a_good_bank_has_no_problems():
    assert check(good_questions()) == {}


def test_types_must_match_the_plan_exactly():
    questions = good_questions()
    plan = [question["type"] for question in questions]
    plan[0] = "true_false"
    assert "plan" in check_bank(bank(*questions), content(), plan, plan_sections(content(), plan))["bank"]


def test_made_up_evidence_is_caught():
    questions = good_questions()
    questions[2] = {**questions[2], "evidence": "this sentence was never in the module at all"}
    assert check(questions)["q3"] == "the evidence is not a quote from the module"


def test_evidence_is_matched_ignoring_case_punctuation_and_spacing():
    questions = good_questions()
    questions[0] = {**questions[0], "evidence": '"A SMALL  action - is tied to something that already happens... every day"'}
    assert check(questions) == {}


def test_evidence_quoted_from_another_section_is_fine_and_the_section_is_corrected():
    unique = "Only the third section ever explains how the sourdough starter is fed each morning."
    module_content = ModuleContent.model_validate(module(sections=[section(), section(), section(explanation=unique + " " + "Filler words that make this long enough to be valid. " * 4)]))
    questions = good_questions()
    questions[0] = {**questions[0], "evidence": unique}
    plan = [question["type"] for question in questions]
    sections = plan_sections(module_content, plan)
    assert check_bank(bank(*questions), module_content, plan, sections) == {}
    assert with_found_sections(bank(*questions), module_content, sections).questions[0].section_index == 2


def test_repeated_questions_are_caught():
    questions = good_questions()
    questions[1] = {**questions[1], "question_text": questions[0]["question_text"]}
    assert check(questions)["q1"] == "the question repeats"


def test_the_letter_of_the_answer_does_not_matter_because_options_are_shuffled_when_a_quiz_is_picked():
    assert check([{**q, "correct_answer": "a"} if q["type"] == "mcq" else q for q in good_questions()]) == {}


def test_a_statement_that_mentions_order_or_several_things_is_still_a_valid_true_false():
    questions = good_questions()
    questions[6] = {**questions[6], "question_text": "The steps should be done in the correct order, and more than one routine can carry a habit."}
    assert check(questions) == {}


def test_a_changed_word_in_a_quote_is_fine_but_a_different_sentence_is_not():
    questions = good_questions()
    questions[0] = {**questions[0], "evidence": "a small action is attached to something that already happens every day"}
    questions[1] = {**questions[1], "evidence": "a large reward is given to somebody who finishes the whole course early"}
    assert set(check(questions)) == {"q2"}


# --- Picking a quiz ---

def full_bank():
    return bank(*good_questions())


def test_a_quiz_has_the_requested_size_and_spans_the_sections():
    quiz = pick_quiz(full_bank(), 3, random.Random(1))
    assert len(quiz) == 3 and {question.section_index for question in quiz} == {0, 1, 2}


@pytest.mark.parametrize("count", [3, 4, 5])
def test_a_quiz_never_repeats_a_question(count):
    quiz = pick_quiz(full_bank(), count, random.Random(count))
    assert len({question.question_id for question in quiz}) == count


def test_different_seeds_give_different_quizzes():
    picks = {tuple(question.question_id for question in pick_quiz(full_bank(), 4, random.Random(seed))) for seed in range(10)}
    assert len(picks) > 1


def test_options_are_shuffled_but_the_answer_ids_still_point_at_the_same_text():
    original = full_bank().questions[0]
    seen = set()
    for seed in range(20):
        shuffled = next(q for q in pick_quiz(full_bank(), 8, random.Random(seed)) if q.question_id == "q1")
        seen.add(tuple(option.id for option in shuffled.options))
        assert {option.id: option.text for option in shuffled.options} == {option.id: option.text for option in original.options}
    assert len(seen) > 1


def test_an_ordering_question_is_never_shown_in_its_answer_order_and_keeps_its_answer():
    ordering = bank(*good_questions()[:7], order(8, 1))
    for seed in range(20):
        shown = next(q for q in pick_quiz(ordering, 8, random.Random(seed)) if q.type == "order")
        assert shown.shown != STEPS and sorted(shown.shown) == sorted(STEPS) and shown.items == STEPS


# --- Prompt ---

def test_each_type_has_its_own_prompt_with_only_its_own_rule():
    for kind in ("mcq", "msq", "true_false", "order"):
        prompt = bank_system(kind)
        assert TYPE_RULES[kind] in prompt and "VERBATIM" in prompt
        assert all(TYPE_RULES[other] not in prompt for other in TYPE_RULES if other != kind)


def test_questions_must_stand_alone_without_pointing_at_the_module():
    assert 'never say "the module"' in bank_system("mcq")


def test_the_question_writer_sees_the_module_text_and_which_section_each_question_comes_from():
    text = bank_user(content(), "msq", [1, 2])
    assert "[Section 0]" in text and text.endswith("Write exactly 2 questions of type msq, the first from section 1, then section 2.")


# --- Writing the bank ---

REPLIES = {
    "mcq": lambda: [mcq(n, [0, 1, 2, 0][n - 1], "abcd"[n % 4]) for n in range(1, 5)],
    "msq": lambda: [msq(1, 1), msq(2, 2)],
    "true_false": lambda: [true_false(1, 0), true_false(2, 1, False)],
}


@pytest.fixture
def model(monkeypatch):
    """A model that answers each per-type request from REPLIES (or from `override`) and records the type asked for."""

    class Model:
        requests: list = []
        override: dict = {}

    state = Model()
    state.requests, state.override = [], {}

    async def chat_json(system, user, max_tokens=0, thinking=False, schema=None, kind="call"):
        asked = re.search(r"of type (\w+),", user).group(1)
        state.asked_count = int(re.search(r"Write exactly (\d+)", user).group(1))
        state.requests.append(asked)
        reply = state.override.get(asked) or REPLIES[asked]
        return {"questions": reply() if callable(reply) else reply}

    monkeypatch.setattr(llm, "chat_json", chat_json)
    return state


def test_the_bank_is_written_with_one_call_per_type_and_every_question_has_the_type_it_was_asked_for(model):
    result = asyncio.run(write_bank(content()))
    assert sorted(model.requests) == ["mcq", "msq", "true_false"]
    assert [question.type for question in result.questions] == plan_types(content())
    assert [question.question_id for question in result.questions] == [f"q{n}" for n in range(1, 9)]


def test_the_section_of_each_question_is_set_by_where_its_evidence_is_found_not_by_the_model(model):
    model.override["msq"] = lambda: [{**msq(1, 2)}, {**msq(2, 2)}]
    result = asyncio.run(write_bank(content()))
    assert [question.section_index for question in result.questions] == plan_sections(content(), plan_types(content()))


def test_a_batch_with_the_wrong_number_of_questions_is_asked_again(model):
    answers = [REPLIES["mcq"]()[:3], REPLIES["mcq"]()]
    model.override["mcq"] = lambda: answers.pop(0)
    asyncio.run(write_bank(content()))
    assert model.requests.count("mcq") == 2


def test_only_the_type_with_a_bad_question_is_written_again(model):
    answers = [[{**true_false(1, 0), "question_text": "Which habit idea does the module describe best?"}, true_false(2, 1, False)], [true_false(1, 0)]]
    model.override["true_false"] = lambda: answers.pop(0)
    result = asyncio.run(write_bank(content()))
    assert model.requests.count("true_false") == 2 and model.requests.count("mcq") == 1
    assert "Which" not in result.questions[6].question_text


def test_a_rewrite_asks_only_for_the_failed_questions(model):
    asked = []
    answers = [[{**true_false(1, 0), "evidence": "a quote that is not in the module at all"}, true_false(2, 1, False)], [true_false(1, 0)]]

    def reply():
        asked.append(len(answers[0]))
        return answers.pop(0)

    model.override["true_false"] = reply
    asyncio.run(write_bank(content()))
    assert asked == [2, 1]


def bad_evidence(question: dict) -> dict:
    return {**question, "evidence": "a quote that is not in the module at all"}


def test_questions_that_never_pass_are_left_out_when_enough_good_ones_remain(model):
    spent = usage.begin()
    model.override["true_false"] = lambda: [bad_evidence(true_false(n, 0)) for n in range(1, model.asked_count + 1)]
    result = asyncio.run(write_bank(content()))
    assert len(result.questions) == 6 and [q.question_id for q in result.questions] == [f"q{n}" for n in range(1, 7)]
    assert "never passed" in spent.notes[-1] and {q.type for q in result.questions} == {"mcq", "msq"}


def test_a_bank_with_too_few_good_questions_is_refused(model):
    model.override["mcq"] = lambda: [bad_evidence(mcq(n, 0)) for n in range(1, model.asked_count + 1)]
    with pytest.raises(HTTPException) as error:
        asyncio.run(write_bank(content()))
    assert error.value.status_code == 502


# --- Small replies ---

def test_a_lone_question_without_the_wrapper_is_accepted():
    from question_bank import McqBatch

    assert len(McqBatch.model_validate(mcq(1)).questions) == 1


def test_a_bare_list_of_questions_is_accepted():
    from question_bank import McqBatch

    assert len(McqBatch.model_validate([mcq(1), mcq(2)]).questions) == 2


def test_a_wrapped_reply_is_left_alone():
    from question_bank import McqBatch

    assert len(McqBatch.model_validate({"questions": [mcq(1)]}).questions) == 1


# --- Repairing small wording slips ---

def test_a_multiple_select_stem_without_its_cue_gets_it():
    from question_bank import tidy

    question = bank(*good_questions()[:4], {**msq(5), "question_text": "Which of these are key factors for the audience?"}, *good_questions()[5:]).questions[4]
    assert tidy(question).question_text == "Which of these are key factors for the audience? Select all that apply."


def test_a_stem_that_already_has_the_cue_is_left_alone():
    from question_bank import tidy

    question = bank(*good_questions()).questions[4]
    assert tidy(question).question_text == question.question_text


@pytest.mark.parametrize("stem, tidied", [
    ("Which step comes first, according to Section 0?", "Which step comes first?"),
    ("Which habit idea is described, as described in the module?", "Which habit idea is described?"),
    ("What does the lesson say about anchors, based on the text.", "What does the lesson say about anchors."),
])
def test_pointers_to_the_text_are_cut_from_the_end_of_a_stem(stem, tidied):
    from question_bank import tidy

    assert tidy(bank({**mcq(1), "question_text": stem}, *good_questions()[1:]).questions[0]).question_text == tidied


def test_a_stem_that_mentions_a_module_in_the_middle_is_not_changed():
    from question_bank import tidy

    stem = "In the module on pricing, which habit idea matters most?"
    assert tidy(bank({**mcq(1), "question_text": stem}, *good_questions()[1:]).questions[0]).question_text == stem


def test_a_bank_written_with_a_missing_cue_passes_without_a_rewrite(model):
    model.override["msq"] = lambda: [{**msq(n, [1, 2][n - 1]), "question_text": f"Which of these are true about habits {n}?"} for n in (1, 2)]
    result = asyncio.run(write_bank(content()))
    assert model.requests.count("msq") == 1 and all(q.question_text.endswith("Select all that apply.") for q in result.questions if q.type == "msq")


# --- Pointers at the lesson anywhere in a question ---

@pytest.mark.parametrize("change", [
    {"explanation": "The module specifies recording every expense in one place."},
    {"explanation": "This lesson explains why anchors work."},
    {"question_text": "In the lesson on pricing, which habit idea matters most?"},
    {"question_text": "Which habit idea is described in Section 2?"},
])
def test_a_question_or_explanation_that_points_at_the_module_is_a_problem(change):
    question = bank({**mcq(1), **change}, *good_questions()[1:]).questions[0]
    assert "must not point at" in wording_problem(question)


def test_an_option_that_points_at_the_module_is_a_problem():
    bad = {**mcq(1), "options": [{"id": "a", "text": "As the module says"}, *options(4)[1:]]}
    assert "must not point at" in wording_problem(bank(bad, *good_questions()[1:]).questions[0])


def test_ordinary_words_like_text_and_module_in_other_senses_are_fine():
    question = bank({**mcq(1), "question_text": "Which tag formats the text of a button label?", "explanation": "A small action is easier to repeat when it follows a routine."}, *good_questions()[1:]).questions[0]
    assert wording_problem(question) is None


def test_the_text_of_a_question_is_cleaned_like_the_lesson():
    question = bank({**mcq(1), "question_text": "Which short‑term goal fits “weekly” checks?"}, *good_questions()[1:]).questions[0]
    assert question.question_text.startswith('Which short-term goal fits "weekly" checks?')
