import asyncio
import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from assemble import assemble_lazy_course
from cache import COURSES
from course_models import Course, Level, TopicKind
from course_requests import MAX_OBJECTIVE_CHARS, CourseRequest, sanitise
import llm
from limits import COURSE_LIMIT, TOPIC_LIMIT
from planning import Outline, OutlineModule, OutlineTopic, fit_outline
from prompts import SOCRATIC_INTERVIEW_SYSTEM, socratic_blueprint_system
from usage import check_budget
from writing import write_module_quiz

router = APIRouter(prefix="/api/courses/forge", tags=["socratic_forge"])
logger = logging.getLogger("nova.socratic_forge")

MAX_TURN_CONTENT = 2000
MAX_HISTORY_TURNS = 10


# --- Models ---

class InterviewTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=MAX_TURN_CONTENT)


class InterviewRequest(BaseModel):
    objective: str = Field(min_length=3, max_length=MAX_OBJECTIVE_CHARS)
    level: Level = "beginner"
    history: List[InterviewTurn] = Field(default_factory=list, max_length=MAX_HISTORY_TURNS)


class InterviewResponse(BaseModel):
    question: str
    turn: int
    maxTurns: int = 3
    readyForBlueprint: bool = False
    suggestions: List[str] = Field(default_factory=list)
    summarySoFar: str = ""


class BlueprintTopicInput(BaseModel):
    title: str
    planet: str = ""
    kind: TopicKind = "concept"
    summary: str = ""
    minutes: int = 7


class BlueprintModuleInput(BaseModel):
    title: str
    topics: List[BlueprintTopicInput] = Field(min_length=1)


class BlueprintRequest(BaseModel):
    objective: str = Field(min_length=3, max_length=MAX_OBJECTIVE_CHARS)
    level: Level = "beginner"
    interviewSummary: str = ""


class FinalizeBlueprintRequest(BaseModel):
    objective: str = Field(min_length=3, max_length=MAX_OBJECTIVE_CHARS)
    level: Level = "beginner"
    title: str
    subtitle: str = ""
    modules: List[BlueprintModuleInput] = Field(min_length=1)


# --- Routes ---

@router.post("/interview", response_model=InterviewResponse, dependencies=[Depends(TOPIC_LIMIT), Depends(check_budget)])
async def socratic_interview_turn(body: InterviewRequest):
    """Processes a diagnostic conversation turn and returns the next targeted question or readiness signal."""
    user_prompt = f"Learner's main goal: {body.objective}\nSelf-reported level: {body.level}\n\nConversation history:\n"
    for turn in body.history:
        user_prompt += f"{turn.role.upper()}: {turn.content}\n"
    current_turn = min(3, len(body.history) // 2 + 1)
    user_prompt += f"\nGenerate turn {current_turn} response."

    response = await llm.ask(
        InterviewResponse,
        SOCRATIC_INTERVIEW_SYSTEM,
        user_prompt,
        max_tokens=600,
        kind="socratic_interview",
    )
    return response


@router.post("/blueprint", response_model=Outline, dependencies=[Depends(TOPIC_LIMIT), Depends(check_budget)])
async def generate_blueprint(body: BlueprintRequest):
    """Generates an initial editable blueprint outline from the diagnostic intake."""
    prompt = f"Goal: {body.objective}\nLevel: {body.level}\nLearner Intake Profile:\n{body.interviewSummary}"
    raw_outline = await llm.ask(
        Outline,
        socratic_blueprint_system(body.level),
        prompt,
        max_tokens=2500,
        kind="socratic_blueprint",
    )
    return fit_outline(raw_outline)


@router.post("/finalize", response_model=Course, dependencies=[Depends(COURSE_LIMIT), Depends(check_budget)])
async def finalize_custom_blueprint(body: FinalizeBlueprintRequest):
    """Converts the approved blueprint into an official lazy Course with quizzes adhering strictly to Course schema."""
    request = CourseRequest(mode="goal", level=body.level, objective=body.objective)

    outline_modules = [
        OutlineModule(
            title=m.title,
            topics=[
                OutlineTopic(
                    title=t.title,
                    planet=t.planet or f"Planet-{i+1}",
                    kind=t.kind,
                    summary=t.summary or t.title,
                    minutes=t.minutes or 7,
                )
                for i, t in enumerate(m.topics)
            ],
        )
        for m in body.modules
    ]
    outline = Outline(
        title=body.title,
        subtitle=body.subtitle or f"Tailored curriculum for {body.objective}",
        scope="broad" if len(outline_modules) > 3 else "narrow",
        modules=outline_modules,
    )

    # Generate module quizzes for each module
    quizzes = await asyncio.gather(*(write_module_quiz(module, request) for module in outline.modules))

    # Assemble lazy course adhering strictly to the Course schema
    course = assemble_lazy_course(outline, quizzes, request)

    # Store in cache using the standard (level, objective) tuple key
    cache_key = (request.level, request.objective.casefold())
    await COURSES.put(cache_key, course.model_dump(by_alias=True, exclude_none=True))

    return course
