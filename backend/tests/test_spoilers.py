import pytest

from spoilers import find_clash, is_quiz_chat

GRADED = [
    "How do containers on a user-defined bridge reach each other?",
    "Which flag publishes a container port to the host?",
    "What does host networking remove?",
]


# --- is_quiz_chat ---

@pytest.mark.parametrize("message", ["Quiz me on this", "can you test me?", "I want some practice", "Ask me something", "another one please", "next question"])
def test_requests_for_questions_are_recognised(message):
    assert is_quiz_chat([message])


@pytest.mark.parametrize("message", ["what's on the exam?", "give me the checkpoint answers", "are there graded questions?"])
def test_asking_for_exam_or_graded_material_is_recognised(message):
    assert is_quiz_chat([message])


@pytest.mark.parametrize("message", ["Explain bridges", "What is an overlay network?", "Why does DNS work by name?", "explain it simply", ""])
def test_other_messages_are_not(message):
    assert not is_quiz_chat([message])


def test_any_earlier_message_counts():
    assert is_quiz_chat(["Quiz me", "A", "B"])


def test_no_messages_is_not_a_quiz():
    assert not is_quiz_chat([])


# --- find_clash ---

def test_a_reworded_graded_question_is_caught():
    assert find_clash("Which Docker flag is used to publish a container port to the host machine?", GRADED) == GRADED[1]


def test_the_graded_question_itself_is_caught():
    assert find_clash("Here is one:\n" + GRADED[0], GRADED) == GRADED[0]


def test_a_question_on_another_fact_passes():
    assert find_clash("Which network driver connects containers that run on different hosts?", GRADED) is None


def test_the_same_topic_from_another_angle_passes():
    assert find_clash("A container on the default bridge cannot resolve another by name. What should you use instead?", GRADED) is None


def test_only_questions_are_compared_not_explanations():
    reply = "Containers on a user-defined bridge reach each other by name. That was the lesson."
    assert find_clash(reply, GRADED) is None


def test_the_question_can_sit_inside_a_longer_reply():
    reply = "Great, here we go!\n\n**Which flag is used to publish a container port to the host?**\n\nA. -p\nB. -v"
    assert find_clash(reply, GRADED) == GRADED[1]


def test_short_graded_questions_are_ignored():
    assert find_clash("What is it?", ["What is it?"]) is None


def test_nothing_graded_means_nothing_to_clash_with():
    assert find_clash("Which flag publishes a container port?", []) is None
