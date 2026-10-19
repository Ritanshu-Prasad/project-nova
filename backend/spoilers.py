import re

QUIZ_REQUEST = re.compile(r"\b(quiz|test me|practice|question me|ask me|another one|next question)\b", re.IGNORECASE)
SENTENCE_END = re.compile(r"(?<=[?.!])\s+|\n+")
WORDS = re.compile(r"[a-z0-9]{4,}")
COMMON = {"which", "what", "does", "that", "with", "this", "from", "when", "have", "would", "should", "about", "these", "their", "there", "following", "correct", "answer"}
CLASH_SHARE = 0.6
MIN_KEY_WORDS = 3


def is_quiz_chat(user_messages: list[str]) -> bool:
    """True when the learner has asked to be quizzed at any point in the conversation."""
    return any(QUIZ_REQUEST.search(message) for message in user_messages)


def find_clash(reply: str, graded: list[str]) -> str | None:
    """The graded question a question in `reply` is too close to, or None."""
    questions = [part for part in SENTENCE_END.split(reply) if part.strip(" *_`").endswith("?")]
    for graded_question in graded:
        key = _key_words(graded_question)
        if len(key) < MIN_KEY_WORDS:
            continue
        for question in questions:
            if len(key & _key_words(question)) / len(key) >= CLASH_SHARE:
                return graded_question
    return None


def _key_words(text: str) -> set[str]:
    return set(WORDS.findall(text.lower())) - COMMON
