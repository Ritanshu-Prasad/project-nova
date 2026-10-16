import logging
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

import shared
from course_models import Level
from limits import FEEDBACK_LIMIT

router = APIRouter()
logger = logging.getLogger("nova.calibration")

MAX_BATCH = 100
KEPT_SECONDS = 365 * 24 * 3600


class AnswerResult(BaseModel):
    """One answer to one question. The question is only a hash of its text, and there is no learner identifier."""
    hash: str = Field(pattern=r"^[0-9a-f]{16}$")
    level: Level
    correct: bool


class AnswerBatch(BaseModel):
    answers: List[AnswerResult] = Field(min_length=1, max_length=MAX_BATCH)


@router.post("/api/feedback/answers", dependencies=[Depends(FEEDBACK_LIMIT)])
async def record_answers(body: AnswerBatch):
    """Counts how often each question is answered right at each level, to check the difficulty the model claimed."""
    try:
        for answer in body.answers:
            await shared.state.add(_key(answer.hash, answer.level, "seen"), 1, KEPT_SECONDS)
            if answer.correct:
                await shared.state.add(_key(answer.hash, answer.level, "right"), 1, KEPT_SECONDS)
    except shared.StateError as error:
        logger.warning("Answers not counted: %s", error)
    return {"counted": len(body.answers)}


async def observed_difficulty(question_hash: str, level: str) -> tuple[int, float | None]:
    """How many times a question was answered at a level, and the share of those answers that were right."""
    seen = int(await shared.state.get(_key(question_hash, level, "seen")) or 0)
    if not seen:
        return 0, None
    return seen, int(await shared.state.get(_key(question_hash, level, "right")) or 0) / seen


def _key(question_hash: str, level: str, kind: str) -> str:
    return f"nova:answers:{question_hash}:{level}:{kind}"
