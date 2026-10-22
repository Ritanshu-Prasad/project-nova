import time
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

import records
from limits import FEEDBACK_LIMIT
from prompts import sanitise
from request_context import request_id_var

router = APIRouter()

NAME = "reports"
MAX_PER_DAY = 500
Reason = Literal["wrong_answer", "unclear", "wrong_type", "off_topic", "other"]


class QuestionReport(BaseModel):
    """A learner's report on one question. It carries the question's text and what is wrong, and nothing that says who sent it."""
    question: str = Field(min_length=3, max_length=600)
    reason: Reason
    note: str = Field(default="", max_length=300)

    @field_validator("question", "note")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, 600)


@router.post("/api/feedback/report", dependencies=[Depends(FEEDBACK_LIMIT)])
async def report_question(body: QuestionReport):
    await records.push(NAME, {"time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "request_id": request_id_var.get(), **body.model_dump()}, MAX_PER_DAY)
    return {"thanks": True}


async def recent(limit: int) -> list[dict]:
    return (await records.newest(NAME, MAX_PER_DAY))[:limit]
