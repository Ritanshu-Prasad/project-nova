from typing import List

from pydantic import BaseModel, Field

import llm

JUDGE_TOKENS = 600
JUDGE_PROMPT = """You are a strict teaching reviewer. Score one lesson for a course on the stated goal and level, as JSON:
{"accuracy": 1-5, "clarity": 1-5, "level_fit": 1-5, "alignment": 1-5, "notes": str}

Rules:
- accuracy: are the statements and examples correct? 1 means serious errors.
- clarity: is it well organised and easy to follow for the stated level?
- level_fit: does depth, vocabulary and math match the stated level?
- alignment: do the lesson's own objectives match what the lesson actually teaches?
- "notes" is one sentence naming the biggest problem, or "none".
Reply with JSON only."""


class Scores(BaseModel):
    accuracy: int = Field(ge=1, le=5)
    clarity: int = Field(ge=1, le=5)
    level_fit: int = Field(ge=1, le=5)
    alignment: int = Field(ge=1, le=5)
    notes: str = ""

    @property
    def average(self) -> float:
        return (self.accuracy + self.clarity + self.level_fit + self.alignment) / 4


async def judge_lesson(goal: str, level: str, objectives: List[str], text: str) -> Scores:
    user = f"Goal: {goal}\nLevel: {level}\nObjectives: {'; '.join(objectives)}\n\nLesson:\n{text[:6000]}"
    return await llm.ask(Scores, JUDGE_PROMPT, user, JUDGE_TOKENS, kind="judge")
