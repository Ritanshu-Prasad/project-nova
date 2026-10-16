import asyncio
import logging
import os
from typing import List

from fastapi import HTTPException
from pydantic import BaseModel

import llm
from course_models import MIN_QUESTIONS, Question
from prompts import answer_system

logger = logging.getLogger("nova.answers")

CHECKABLE = {"mcq", "multi", "truefalse"}
TOKENS_PER_QUESTION = 40
BASE_TOKENS = 100
VOTES = 2


class BlindAnswer(BaseModel):
    number: int
    choice: List[int]


class BlindAnswers(BaseModel):
    answers: List[BlindAnswer]


async def drop_disputed(questions: List[Question], level: str, context: str = "") -> List[Question]:
    """Has the model answer the questions without seeing the key, and drops those where every attempt disagrees.

    A key the model cannot reproduce is more likely wrong than the question is hard, and asking twice keeps one
    unlucky answer from removing a good question. Nothing is dropped if that would leave too few questions, and
    a failing check leaves the questions as they were. Questions written from documents are not checked unless
    NOVA_VERIFY_DOCUMENTS=on, because every vote would have to read the document excerpts again.
    """
    if os.getenv("NOVA_VERIFY_ANSWERS") == "off" or (context and os.getenv("NOVA_VERIFY_DOCUMENTS") != "on"):
        return questions
    checkable = [(position, question) for position, question in enumerate(questions) if question.type in CHECKABLE]
    if not checkable:
        return questions
    try:
        votes = await asyncio.gather(*(_vote(level, checkable, context) for _ in range(VOTES)))
    except HTTPException as error:
        logger.warning("Answer check skipped: %s", error.detail)
        return questions
    disputed = {position for number, (position, question) in enumerate(checkable, start=1) if all(number in vote and vote[number] != _key(question) for vote in votes)}
    kept = [question for position, question in enumerate(questions) if position not in disputed]
    if disputed:
        logger.info("Answer check dropped %d of %d questions", len(disputed), len(questions))
    return kept if len(kept) >= MIN_QUESTIONS else questions


async def _vote(level: str, checkable: list, context: str) -> dict:
    tokens = BASE_TOKENS + TOKENS_PER_QUESTION * len(checkable)
    reply = await llm.ask(BlindAnswers, answer_system(level), _render(checkable, context), tokens, kind="answers")
    return {answer.number: set(answer.choice) for answer in reply.answers}


def _render(checkable: list, context: str) -> str:
    blocks = [_describe(number, question) for number, (_, question) in enumerate(checkable, start=1)]
    return (f"Document excerpts:\n{context}\n\n" if context else "") + "\n\n".join(blocks)


def _describe(number: int, question: Question) -> str:
    options = ["True", "False"] if question.type == "truefalse" else question.options
    kind = "select all that apply" if question.type == "multi" else "choose one"
    listed = "\n".join(f"{index}. {option}" for index, option in enumerate(options))
    return f"Question {number} ({kind}): {question.q}\n{listed}"


def _key(question: Question) -> set:
    if question.type == "mcq":
        return {question.answer}
    if question.type == "multi":
        return set(question.answers)
    return {0 if question.answer else 1}
