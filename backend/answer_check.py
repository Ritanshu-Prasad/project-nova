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


async def drop_disputed(questions: List[Question], context: str = "", minimum: int = MIN_QUESTIONS, open_book: bool = False) -> List[Question]:
    """Has the model answer the questions without seeing the key, and drops those where every attempt disagrees.

    A key the model cannot reproduce is more likely wrong than the question is hard, and asking again keeps one
    unlucky answer from removing a good question. The second vote is only asked when the first disputes something,
    which is the only case where it can change the outcome. Nothing is dropped if that would leave too few questions, and
    a failing check leaves the questions as they were.

    Questions about a particular lesson cannot be answered blind, so with `open_book` the lesson is given as
    `context` and the check asks whether the key follows from it. Otherwise questions written from documents are
    not checked unless NOVA_VERIFY_DOCUMENTS=on, because every vote would have to read the excerpts again.
    """
    if os.getenv("NOVA_VERIFY_ANSWERS") == "off" or (context and not open_book and os.getenv("NOVA_VERIFY_DOCUMENTS") != "on"):
        return questions
    checkable = [(position, question) for position, question in enumerate(questions) if question.type in CHECKABLE]
    if not checkable:
        return questions
    try:
        disputed = await _disputed(checkable, context)
    except HTTPException as error:
        logger.warning("Answer check skipped: %s", error.detail)
        return questions
    kept = [question for position, question in enumerate(questions) if position not in disputed]
    if disputed:
        logger.info("Answer check dropped %d of %d questions", len(disputed), len(questions))
    return kept if len(kept) >= minimum else questions


async def _disputed(checkable: list, context: str) -> set:
    """Positions of the questions every vote disputes; a vote is only asked while the earlier ones disputed something."""
    disputed = None
    for _ in range(VOTES):
        vote = await _vote(checkable, context)
        now = {position for number, (position, question) in enumerate(checkable, start=1) if number in vote and vote[number] != _key(question)}
        disputed = now if disputed is None else disputed & now
        if not disputed:
            break
    return disputed


async def _vote(checkable: list, context: str) -> dict:
    tokens = BASE_TOKENS + TOKENS_PER_QUESTION * len(checkable)
    reply = await llm.ask(BlindAnswers, answer_system(), _render(checkable, context), tokens, kind="answers")
    return {answer.number: set(answer.choice) for answer in reply.answers}


def _render(checkable: list, context: str) -> str:
    blocks = [_describe(number, question) for number, (_, question) in enumerate(checkable, start=1)]
    return (f"Reference text:\n{context}\n\n" if context else "") + "\n\n".join(blocks)


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


async def agreement(questions: List[Question], context: str = "") -> float:
    """The share of checkable questions whose key the model reproduces blind; 1.0 when none can be checked."""
    checkable = [(position, question) for position, question in enumerate(questions) if question.type in CHECKABLE]
    if not checkable:
        return 1.0
    vote = await _vote(checkable, context)
    agreeing = sum(1 for number, (_, question) in enumerate(checkable, start=1) if vote.get(number) == _key(question))
    return agreeing / len(checkable)
