import asyncio
import logging
from dataclasses import dataclass
from typing import List, Optional

from fastapi import HTTPException

import llm
from course_models import Lesson, Question, QuestionList
from course_requests import CourseRequest, describe_request
from planning import Outline, OutlineModule, OutlineTopic
from prompts import lesson_system, questions_system

logger = logging.getLogger("nova.writing")

QUIZ_SIZE = 8
PRACTICE_SIZE = 12
MODULE_QUIZ_SIZE = 10


@dataclass
class TopicContent:
    lesson: Lesson
    quiz: List[Question]
    practice: List[Question]


# --- Writing ---

async def write_topic(module_title: str, topic: OutlineTopic, request: CourseRequest, context: str) -> TopicContent:
    """A topic's lesson, quiz and practice questions, written at the same time."""
    grounded = bool(context)
    user = f'{describe_request(request, context)}\n\nTopic: "{topic.title}" ({topic.summary}) from the module "{module_title}".'
    lesson, quiz, practice = await asyncio.gather(
        llm.ask(Lesson, lesson_system(request.level, grounded), user),
        llm.ask(QuestionList, questions_system(request.level, QUIZ_SIZE, grounded), user),
        llm.ask(QuestionList, questions_system(request.level, PRACTICE_SIZE, grounded), user),
    )
    return TopicContent(lesson, quiz.questions, practice.questions)


async def write_module_quiz(module: OutlineModule, request: CourseRequest) -> List[Question]:
    """The end-of-module quiz; if it cannot be written the module simply has none and the app builds one from its topics."""
    system = questions_system(request.level, MODULE_QUIZ_SIZE, grounded=False)
    topics = "\n".join(f"- {topic.title}: {topic.summary}" for topic in module.topics)
    user = f'{describe_request(request, "")}\n\nEnd-of-module quiz for the module "{module.title}", covering all of its topics:\n{topics}'
    try:
        return (await llm.ask(QuestionList, system, user)).questions
    except HTTPException as error:
        logger.warning("Module quiz for %r skipped: %s", module.title, error.detail)
        return []


async def write_all_topics(outline: Outline, request: CourseRequest, contexts: List[str]) -> List[List[Optional[TopicContent]]]:
    """Every topic is written at once; a topic that fails comes back as None."""

    async def write(module: OutlineModule, topic: OutlineTopic, context: str) -> Optional[TopicContent]:
        try:
            return await write_topic(module.title, topic, request, context)
        except HTTPException as error:
            logger.warning("Topic %r skipped: %s", topic.title, error.detail)
            return None

    jobs = [write(module, topic, context) for module, context in zip(outline.modules, contexts) for topic in module.topics]
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
