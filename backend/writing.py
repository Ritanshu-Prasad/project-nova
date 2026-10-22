import asyncio
import logging
from dataclasses import dataclass
from itertools import zip_longest
from typing import List, Optional, Sequence

from fastapi import HTTPException

import llm
from answer_check import drop_disputed
from cache import BANKS
from course_adapter import to_lesson, to_question
from course_models import Lesson, Question, QuestionList
from course_requests import CourseRequest, describe_request, describe_topic
from module_content import write_module
from planning import Outline, OutlineModule, OutlineTopic
from progress import Report, ignore
from prompts import lesson_system, questions_system
from question_bank import QuestionBank, pick_from, write_bank

logger = logging.getLogger("nova.writing")

QUIZ_SIZE = 8
PRACTICE_SIZE = 12
MODULE_QUIZ_SIZE = 5
LESSON_TOKENS = 4500


@dataclass
class TopicContent:
    lesson: Lesson
    quiz: List[Question]
    practice: List[Question]


# --- Writing ---

def question_tokens(count: int) -> int:
    return 500 + 450 * count


async def write_topic(module_title: str, topic: OutlineTopic, request: CourseRequest, context: str, outline: Sequence[str] = (), previous: str = "") -> TopicContent:
    """A topic's lesson, quiz and practice questions. From a goal they come from the module writer and a checked question bank; from documents, from the document excerpts."""
    if context:
        return await _write_grounded_topic(module_title, topic, request, context, outline, previous)
    return await _write_goal_topic(module_title, topic, request, outline, previous)


# --- A topic from a goal ---

def bank_key(objective: str, module_title: str, topic_title: str) -> tuple:
    return ("bank", objective.casefold(), module_title.casefold(), topic_title.casefold())


async def _write_goal_topic(module_title: str, topic: OutlineTopic, request: CourseRequest, outline: Sequence[str], previous: str) -> TopicContent:
    """The lesson is a written module; its questions come from a bank whose every question quotes the lesson. The bank is kept for the end-of-module quiz."""
    content = await write_module(topic.title, _expectations(request, module_title, topic, outline, previous), [])
    bank = await write_bank(content)
    await BANKS.put(bank_key(request.objective, module_title, topic.title), bank.model_dump())
    questions = pick_from(await _undisputed(bank.questions), len(bank.questions))
    half = (len(questions) + 1) // 2
    return TopicContent(to_lesson(content), [to_question(q) for q in questions[:half]], [to_question(q) for q in questions[half:]])


def _expectations(request: CourseRequest, module_title: str, topic: OutlineTopic, outline: Sequence[str], previous: str) -> str:
    parts = [f"The learner's goal: {request.objective}.", f'This is the topic "{topic.title}" ({topic.summary}) of the module "{module_title}".']
    if outline:
        parts.append("Course outline: " + "; ".join(outline) + ".")
    if previous:
        parts.append(f"The previous topic covered: {previous}")
    return " ".join(parts)


async def _undisputed(questions: list) -> list:
    """The bank questions whose key the model reproduces when it answers blind; the check works on the app's question shape."""
    converted = [to_question(question) for question in questions]
    kept = {id(question) for question in await drop_disputed(converted, "intermediate")}
    return [question for question, shaped in zip(questions, converted) if id(shaped) in kept]


async def module_quiz(banks: list[dict], size: int = MODULE_QUIZ_SIZE) -> list[Question]:
    """The end-of-module quiz: questions drawn in turn from the banks of the module's topics, so every topic is asked about."""
    drawn = [pick_from(QuestionBank.model_validate(bank).questions, len(bank["questions"])) for bank in banks]
    interleaved = [question for round_ in zip_longest(*drawn) for question in round_ if question is not None]
    return [to_question(question) for question in interleaved[:size]]


# --- A topic from documents ---

async def _write_grounded_topic(module_title: str, topic: OutlineTopic, request: CourseRequest, context: str, outline: Sequence[str], previous: str) -> TopicContent:
    grounded = bool(context)
    user = f"{describe_request(request, context)}\n\n{describe_topic(module_title, topic.title, topic.summary, list(outline), previous)}"
    lesson, quiz, practice = await asyncio.gather(
        llm.ask(Lesson, lesson_system(request.level, grounded, in_course=bool(outline or previous)), user, LESSON_TOKENS, kind="lesson"),
        _graded_quiz(request, grounded, user, context),
        llm.ask(QuestionList, questions_system(request.level, PRACTICE_SIZE, grounded), user, question_tokens(PRACTICE_SIZE), kind="practice"),
    )
    return TopicContent(lesson, quiz, practice.questions)


async def _graded_quiz(request: CourseRequest, grounded: bool, user: str, context: str) -> List[Question]:
    """The questions that count towards a module pass are also checked against an independent answer."""
    written = await llm.ask(QuestionList, questions_system(request.level, QUIZ_SIZE, grounded), user, question_tokens(QUIZ_SIZE), kind="quiz")
    return await drop_disputed(written.questions, request.level, context)


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
