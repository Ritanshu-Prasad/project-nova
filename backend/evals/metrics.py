import re
from collections import Counter

from course_models import Question

SENTENCE_END = re.compile(r"[.!?]+")
WORD = re.compile(r"[A-Za-z']+")
VOWEL_GROUP = re.compile(r"[aeiouy]+")


# --- Text ---

def reading_grade(text: str) -> float:
    """Flesch-Kincaid grade level: roughly the school year needed to follow the text."""
    words = WORD.findall(text)
    sentences = [part for part in SENTENCE_END.split(text) if WORD.search(part)]
    if not words or not sentences:
        return 0.0
    syllables = sum(_syllables(word) for word in words)
    return 0.39 * len(words) / len(sentences) + 11.8 * syllables / len(words) - 15.59


def _syllables(word: str) -> int:
    word = word.lower().rstrip("e") or word.lower()
    return max(1, len(VOWEL_GROUP.findall(word)))


def level_gap(easier: str, harder: str) -> float:
    """How many grade levels harder the second text reads than the first; it should be above zero."""
    return reading_grade(harder) - reading_grade(easier)


# --- Questions ---

def duplicate_rate(questions: list[Question]) -> float:
    stems = [re.sub(r"[^a-z0-9]+", " ", question.q.lower()).strip() for question in questions]
    return (len(stems) - len(set(stems))) / len(stems) if stems else 0.0


def type_mix(questions: list[Question]) -> dict[str, int]:
    return dict(sorted(Counter(question.type for question in questions).items()))


# --- Runs ---

def retry_rate(calls: int, retries: int) -> float:
    return retries / calls if calls else 0.0


def citation_survival(before: int, after: int) -> float:
    """The share of quotes that were really in the documents; 1.0 when the model made none up."""
    return after / before if before else 1.0
