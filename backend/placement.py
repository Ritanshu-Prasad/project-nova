from typing import Annotated, List

from pydantic import BaseModel, BeforeValidator, Field, field_validator

import llm
from answer_check import drop_disputed
from course_models import Level, Mcq, drop_invalid
from course_requests import MAX_OBJECTIVE_CHARS
from prompts import placement_system, sanitise, wrap_goal

PLACEMENT_QUESTIONS = 5
MIN_PLACEMENT_QUESTIONS = 4
PLACEMENT_TOKENS = 1500
DIFFICULTY_BY_COUNT = {5: [1, 1, 2, 2, 3], 4: [1, 2, 2, 3]}
INTERMEDIATE_FROM = 0.4
ADVANCED_FROM = 0.75


class PlacementQuiz(BaseModel):
    """What the model writes: multiple-choice questions only, in the order it was asked for, easiest first."""
    questions: Annotated[List[Mcq], BeforeValidator(drop_invalid(Mcq))] = Field(min_length=MIN_PLACEMENT_QUESTIONS)


class PlacementRequest(BaseModel):
    objective: str = Field(max_length=MAX_OBJECTIVE_CHARS)

    @field_validator("objective")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, MAX_OBJECTIVE_CHARS)


class PlacementAnswer(BaseModel):
    difficulty: int = Field(ge=1, le=3)
    correct: bool


class PlacementResult(BaseModel):
    answers: List[PlacementAnswer] = Field(min_length=1, max_length=PLACEMENT_QUESTIONS * 2)


async def write_placement(objective: str) -> List[Mcq]:
    """Five questions from easy to hard. The model's own difficulty labels are ignored: it labels nearly everything easy."""
    quiz = await llm.ask(PlacementQuiz, placement_system(), wrap_goal(objective), PLACEMENT_TOKENS, kind="placement")
    checked = await drop_disputed(quiz.questions[:PLACEMENT_QUESTIONS], "intermediate", minimum=MIN_PLACEMENT_QUESTIONS)
    return [question.model_copy(update={"difficulty": difficulty}) for question, difficulty in zip(checked, DIFFICULTY_BY_COUNT[len(checked)])]


def recommend_level(answers: List[PlacementAnswer]) -> Level:
    """Harder questions count for more: the share of the available difficulty points the learner earned."""
    available = sum(answer.difficulty for answer in answers)
    earned = sum(answer.difficulty for answer in answers if answer.correct)
    share = earned / available if available else 0.0
    if share >= ADVANCED_FROM:
        return "advanced"
    return "intermediate" if share >= INTERMEDIATE_FROM else "beginner"
