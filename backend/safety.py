import logging
import os

from fastapi import HTTPException
from pydantic import BaseModel

import llm
from prompts import safety_system, wrap_goal

logger = logging.getLogger("nova.safety")

VERDICT_TOKENS = 200


class Verdict(BaseModel):
    allowed: bool
    reason: str = ""


async def check_goal(goal: str) -> None:
    """Refuses a goal that is meant to cause serious harm; if the check itself fails, the learner is not blocked."""
    if os.getenv("NOVA_MODERATION") == "off":
        return
    try:
        verdict = await llm.ask(Verdict, safety_system(), wrap_goal(goal), VERDICT_TOKENS)
    except HTTPException as error:
        logger.warning("Goal check skipped: %s", error.detail)
        return
    if not verdict.allowed:
        raise HTTPException(422, verdict.reason or "NOVA can't build a course on that goal.")
