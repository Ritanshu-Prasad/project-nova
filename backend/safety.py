import logging
import os

from fastapi import HTTPException
from pydantic import BaseModel

import llm
from prompts import ORDERS_IN_A_GOAL, safety_system, wrap_goal

logger = logging.getLogger("nova.safety")

VERDICT_TOKENS = 200
ASK_FOR_A_SUBJECT = "Please describe something you want to learn."


class Verdict(BaseModel):
    allowed: bool
    reason: str = ""


def has_orders(goal: str) -> bool:
    """A goal that gives the model orders instead of naming a subject; no model call is needed to see it."""
    return bool(ORDERS_IN_A_GOAL.search(goal))


async def check_goal(goal: str) -> None:
    """Refuses a goal that is meant to cause serious harm; if the check itself fails, the learner is not blocked."""
    if os.getenv("NOVA_MODERATION") == "off":
        return
    if has_orders(goal):
        raise HTTPException(422, ASK_FOR_A_SUBJECT)
    try:
        verdict = await llm.ask(Verdict, safety_system(), wrap_goal(goal), VERDICT_TOKENS, kind="safety")
    except HTTPException as error:
        logger.warning("Goal check skipped: %s", error.detail)
        return
    if not verdict.allowed:
        raise HTTPException(422, verdict.reason or "NOVA can't build a course on that goal.")
