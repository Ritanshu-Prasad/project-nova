import asyncio
import logging
from dataclasses import dataclass
from itertools import zip_longest
from typing import List, Optional, Sequence

from fastapi import HTTPException

from answer_check import drop_disputed
from cache import BANKS
from course_adapter import to_lesson, to_question
from course_models import Lesson, Question
from course_requests import CourseRequest
from module_content import write_module
from planning import Outline, OutlineModule, OutlineTopic
from progress import Report, ignore
from question_bank import QuestionBank, pick_from, write_bank

logger = logging.getLogger("nova.writing")

MODULE_QUIZ_SIZE = 5


@dataclass
class TopicContent:
    lesson: Lesson
    quiz: List[Question]
    practice: List[Question]


# --- Writing ---

async def write_topic(module_title: str, topic: OutlineTopic, request: CourseRequest, context: str, outline: Sequence[str] = (), previous: str = "") -> TopicContent:
    """A topic's lesson, quiz and practice questions.

    The lesson is a written module (only from the document excerpts when there are some); its questions come from a bank
    in which every question quotes the lesson, are checked against an independent answer, and are split between quiz
    and practice. A goal's bank is kept for the end-of-module quiz.
    """
    content = await write_module(topic.title, _expectations(request, module_title, topic, outline, previous), [], context)
    bank = await write_bank(content)
    if not context:
        await BANKS.put(bank_key(request.objective, module_title, topic.title), bank.model_dump())
    questions = pick_from(await _undisputed(bank.questions, content.as_text()), len(bank.questions))
    half = (len(questions) + 1) // 2
    return TopicContent(to_lesson(content), [to_question(q) for q in questions[:half]], [to_question(q) for q in questions[half:]])


def bank_key(objective: str, module_title: str, topic_title: str) -> tuple:
    return ("bank", objective.casefold(), module_title.casefold(), topic_title.casefold())


def _expectations(request: CourseRequest, module_title: str, topic: OutlineTopic, outline: Sequence[str], previous: str) -> str:
    goal = request.objective or request.focus
    parts = [f"The learner's goal: {goal}." if goal else "", f"The learner's expectations: {request.expectations}." if request.expectations else "", f'This is the topic "{topic.title}" ({topic.summary}) of the module "{module_title}".']
    if outline:
        parts.append("Course outline: " + "; ".join(outline) + ".")
    if previous:
        parts.append(f"The previous topic covered: {previous}")
    return " ".join(part for part in parts if part)


async def _undisputed(questions: list, lesson: str) -> list:
    """The bank questions whose key the model reproduces when it answers with the lesson in front of it; the check works on the app's question shape."""
    converted = [to_question(question) for question in questions]
    kept = {id(question) for question in await drop_disputed(converted, lesson, open_book=True)}
    return [question for question, shaped in zip(questions, converted) if id(shaped) in kept]


async def module_quiz(banks: list[dict], size: int = MODULE_QUIZ_SIZE) -> list[Question]:
    """The end-of-module quiz: questions drawn in turn from the banks of the module's topics, so every topic is asked about."""
    drawn = [pick_from(QuestionBank.model_validate(bank).questions, len(bank["questions"])) for bank in banks]
    interleaved = [question for round_ in zip_longest(*drawn) for question in round_ if question is not None]
    return [to_question(question) for question in interleaved[:size]]


async def write_all_topics(outline: Outline, request: CourseRequest, contexts: List[str], report: Report = ignore) -> List[List[Optional[TopicContent]]]:
    """Every topic is written at once; a topic that fails comes back as None."""
    titles = [topic.title for module in outline.modules for topic in module.topics]
    total, finished = len(titles), [0]

    async def write(module: OutlineModule, topic: OutlineTopic, context: str, previous: str) -> Optional[TopicContent]:
        try:
            return await write_topic(module.title, topic, request, context, titles, previous)
        except HTTPException as error:
            logger.warning("Topic %r skipped: %s", topic.title, error.detail)
            return None
        finally:
            finished[0] += 1
            report("topics", f"Writing lessons ({finished[0]} of {total})")

    planned = [(module, topic, context) for module, context in zip(outline.modules, contexts) for topic in module.topics]
    jobs = [write(module, topic, context, planned[number - 1][1].summary if number else "") for number, (module, topic, context) in enumerate(planned)]
    written = iter(await asyncio.gather(*jobs))
    return [[next(written) for _ in module.topics] for module in outline.modules]


def keep_written(outline: Outline, contents: List[List[Optional[TopicContent]]]) -> tuple[Outline, List[List[TopicContent]]]:
    """Removes the topics that could not be written, and any module left empty; fails if nothing is left."""
    modules, kept = [], []
    for module, written in zip(outline.modules, contents):
        pairs = [(topic, content) for topic, content in zip(module.topics, written) if content is not None]
        if pairs:
            modules.append(module.model_copy(update={"topics": [topic for topic, _ in pairs]}))
            kept.append([content for _, content in pairs])
    if not modules:
        raise HTTPException(502, "The course model could not write any lesson")
    return outline.model_copy(update={"modules": modules}), kept
