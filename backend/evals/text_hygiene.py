import re

from course_models import Lesson, Question
from question_bank import POINTS_AT_THE_LESSON
from text_clean import NUMBERING

ODD_TYPOGRAPHY = re.compile("[‐‑‒–—“”‘’ ]")
UNDERSTAND = re.compile(r"^\s*understand\b", re.IGNORECASE)


def strings_of(lesson: Lesson, questions: list[Question]) -> list[str]:
    """Every sentence the learner reads in a topic: the lesson's blocks and objectives, and each question with its options and explanation."""
    texts = [lesson.simple, *lesson.objectives]
    for block in lesson.blocks:
        texts += [getattr(block, "title", None) or "", getattr(block, "body", None) or "", *getattr(block, "points", []), *getattr(block, "steps", [])]
        texts += [f"{term.term} {term.definition}" for term in getattr(block, "terms", [])]
    for question in questions:
        texts += [question.q, question.why, *getattr(question, "options", []), *getattr(question, "items", [])]
    return [text for text in texts if text]


def hygiene_issues(lesson: Lesson, questions: list[Question]) -> dict[str, int]:
    """Counts of the slips that make generated text look careless; every count should be zero."""
    titles = [block.title for block in lesson.blocks if block.type == "text" and block.title]
    texts = strings_of(lesson, questions)
    asked = [question.q for question in questions]
    questioned = [text for question in questions for text in (question.q, question.why, *getattr(question, "options", []), *getattr(question, "items", []))]
    return {
        "odd_typography": sum(1 for text in texts if ODD_TYPOGRAPHY.search(text)),
        "numbered_titles": sum(1 for title in titles if NUMBERING.match(title)),
        "understand_objectives": sum(1 for objective in lesson.objectives if UNDERSTAND.match(objective)),
        "points_at_the_lesson": sum(1 for text in questioned if POINTS_AT_THE_LESSON.search(text)),
        "repeated_titles": len(titles) - len({title.casefold() for title in titles}),
        "repeated_questions": len(asked) - len({question.casefold() for question in asked}),
    }
