import asyncio
import logging
from dataclasses import dataclass
from typing import List, Optional, Sequence

from fastapi import HTTPException

import llm
from answer_check import drop_disputed
from course_models import Lesson, Question, QuestionList
from course_requests import CourseRequest, TaughtTopic, describe_request, describe_taught, describe_topic
from planning import Outline, OutlineModule, OutlineTopic
from progress import Report, ignore
from prompts import lesson_system, questions_system

logger = logging.getLogger("nova.writing")

QUIZ_SIZE = 8
PRACTICE_SIZE = 12
MODULE_QUIZ_SIZE = 10
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
    """A topic's lesson, quiz and practice questions, written at the same time."""
    grounded = bool(context)
    user = f"{describe_request(request, context)}\n\n{describe_topic(module_title, topic.title, topic.summary, list(outline), previous)}"
    lesson, quiz, practice = await asyncio.gather(
        llm.ask(Lesson, lesson_system(request.level, grounded, in_course=bool(outline or previous)), user, LESSON_TOKENS),
        _graded_quiz(request, grounded, user, context),
        llm.ask(QuestionList, questions_system(request.level, PRACTICE_SIZE, grounded), user, question_tokens(PRACTICE_SIZE)),
    )
    return TopicContent(lesson, quiz, practice.questions)


async def _graded_quiz(request: CourseRequest, grounded: bool, user: str, context: str) -> List[Question]:
    """The questions that count towards a module pass are also checked against an independent answer."""
    written = await llm.ask(QuestionList, questions_system(request.level, QUIZ_SIZE, grounded), user, question_tokens(QUIZ_SIZE))
    return await drop_disputed(written.questions, request.level, context)


async def write_module_quiz(module: OutlineModule, request: CourseRequest) -> List[Question]:
    """The end-of-module quiz; if it cannot be written the module simply has none and the app builds one from its topics."""
    system = questions_system(request.level, MODULE_QUIZ_SIZE, grounded=False)
    topics = "\n".join(f"- {topic.title}: {topic.summary}" for topic in module.topics)
    user = f'{describe_request(request, "")}\n\nEnd-of-module quiz for the module "{module.title}", covering all of its topics:\n{topics}'
    try:
        return (await llm.ask(QuestionList, system, user, question_tokens(MODULE_QUIZ_SIZE))).questions
    except HTTPException as error:
        logger.warning("Module quiz for %r skipped: %s", module.title, error.detail)
        return []


async def write_module_quiz_from_lessons(request: CourseRequest, module_title: str, taught: List[TaughtTopic]) -> List[Question]:
    """The end-of-module quiz written from what the lessons really covered, so it never asks about anything untaught."""
    system = questions_system(request.level, MODULE_QUIZ_SIZE, grounded=False)
    user = f"{describe_request(request, '')}\n\n{describe_taught(module_title, taught)}"
    written = await llm.ask(QuestionList, system, user, question_tokens(MODULE_QUIZ_SIZE))
    return await drop_disputed(written.questions, request.level)


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
