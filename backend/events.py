from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

import usage
from limits import FEEDBACK_LIMIT

router = APIRouter()

FUNNEL = ("course_started", "topic_finished", "module_quiz_finished", "course_finished")


class UsageEvent(BaseModel):
    """One step of a learner's journey. It is only a name: no course, no text and nothing that says who it was."""
    event: Literal["course_started", "topic_finished", "module_quiz_finished", "course_finished"]


@router.post("/api/events", dependencies=[Depends(FEEDBACK_LIMIT)])
async def count_event(body: UsageEvent):
    """Counts the step in the day's totals, so the admin page can show where learners stop."""
    await usage.record_event(f"funnel:{body.event}")
    return {"counted": True}
