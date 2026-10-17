import math
import re
from collections import Counter
from typing import Callable, Iterable

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


def first_try_rate(calls: int, retries: int) -> float:
    """The share of model calls whose answer was usable the first time."""
    return max(0.0, 1 - retry_rate(calls, retries)) if calls else 1.0


def percentile(values: list[float], share: float) -> float | None:
    """The value below which `share` percent of the values fall (nearest rank); None without values."""
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, math.ceil(share / 100 * len(ordered)) - 1)]


def fraction(items: Iterable, predicate: Callable) -> float | None:
    """The share of items for which `predicate` holds; None when there are no items."""
    items = list(items)
    return sum(1 for item in items if predicate(item)) / len(items) if items else None


def precision_recall(expected: list[bool], predicted: list[bool]) -> tuple[float | None, float | None]:
    """Of what was flagged, how much should have been (precision), and of what should be, how much was (recall)."""
    flagged = sum(predicted)
    wanted = sum(expected)
    true_positives = sum(1 for want, got in zip(expected, predicted) if want and got)
    return (true_positives / flagged if flagged else None), (true_positives / wanted if wanted else None)


# Reading grades that suit each level; reported, and not yet a gate.
GRADE_RANGES = {"beginner": (0.0, 9.0), "intermediate": (9.0, 12.0), "advanced": (12.0, 99.0)}


def grade_in_range(grade: float, level: str) -> bool:
    low, high = GRADE_RANGES[level]
    return low <= grade < high


def citation_survival(before: int, after: int) -> float:
    """The share of quotes that were really in the documents; 1.0 when the model made none up."""
    return after / before if before else 1.0
