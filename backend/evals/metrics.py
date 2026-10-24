import math
import re
from collections import Counter
from itertools import combinations
from typing import Callable, Iterable

from course_models import Question
from module_content import EXTRAS, ModuleContent

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


def length_ratio(shorter: str, longer: str) -> float:
    """How many times longer the second text is than the first; a deeper request should give a ratio above one."""
    return len(longer.split()) / max(1, len(shorter.split()))


# --- Questions ---

def duplicate_rate(questions: list[Question]) -> float:
    stems = [re.sub(r"[^a-z0-9]+", " ", question.q.lower()).strip() for question in questions]
    return (len(stems) - len(set(stems))) / len(stems) if stems else 0.0


def type_mix(questions: list[Question]) -> dict[str, int]:
    return dict(sorted(Counter(question.type for question in questions).items()))


# --- Modules and outlines ---

def repeated_extras(content: ModuleContent) -> int:
    """How many neighbouring section pairs share an extra kind; the validator drops these, so the extras are assigned by position, so any above zero means the prompt was not followed."""
    kinds = [{name for name in EXTRAS if getattr(section, name)} for section in content.sections]
    return sum(len(before & after) for before, after in zip(kinds, kinds[1:]))


LIST_LINE = re.compile(r"^\s*(?:[-*]|\d+\.)\s+\S", re.MULTILINE)


def sections_with_lists(content: ModuleContent) -> int:
    """How many sections carry a list, as structured points or as a Markdown list in the explanation; the prompt asks for at least two."""
    return sum(1 for section in content.sections if getattr(section, "points", None) or LIST_LINE.search(section.explanation))


def simple_grade(content: ModuleContent) -> float:
    """The reading grade of a module's plain-language summary."""
    return reading_grade(content.simple)


def topic_overlap(summaries: list[str]) -> float | None:
    """The highest word overlap (Jaccard) between any two summaries; None when there are fewer than two."""
    word_sets = [{word.lower() for word in WORD.findall(summary)} for summary in summaries]
    pairs = list(combinations(word_sets, 2))
    if not pairs:
        return None
    return max(len(first & second) / len(first | second) if first | second else 0.0 for first, second in pairs)


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


def citation_survival(before: int, after: int) -> float:
    """The share of quotes that were really in the documents; 1.0 when the model made none up."""
    return after / before if before else 1.0


def judge_agreement(pairs: list[tuple[float, float]]) -> dict:
    """How the judge's scores compare with a person's, from (judge, human) pairs on the same 1 to 5 scale."""
    if not pairs:
        return {"items": 0, "mean_error": None, "within_one": None, "bias": None, "correlation": None}
    judge, human = [pair[0] for pair in pairs], [pair[1] for pair in pairs]
    return {
        "items": len(pairs),
        "mean_error": sum(abs(j - h) for j, h in pairs) / len(pairs),
        "within_one": sum(1 for j, h in pairs if abs(j - h) <= 1) / len(pairs),
        "bias": sum(j - h for j, h in pairs) / len(pairs),
        "correlation": _correlation(judge, human),
    }


def _correlation(first: list[float], second: list[float]) -> float | None:
    mean_a, mean_b = sum(first) / len(first), sum(second) / len(second)
    spread_a = math.sqrt(sum((a - mean_a) ** 2 for a in first))
    spread_b = math.sqrt(sum((b - mean_b) ** 2 for b in second))
    if not spread_a or not spread_b:
        return None
    return sum((a - mean_a) * (b - mean_b) for a, b in zip(first, second)) / (spread_a * spread_b)
