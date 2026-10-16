import asyncio
import logging
import re
import uuid
from dataclasses import dataclass
from typing import List, Literal, Type, TypeVar

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field, ValidationError, field_validator

from course_models import Course, CourseDocument, Lesson, LessonStub, Level, Module, Question, QuestionList, Topic, TopicKind, TopicStub
from llm import chat_json
from pdf_parser import Page, build_context, extract_pages
from prompts import lesson_system, outline_system, questions_system, sanitise, wrap_goal

router = APIRouter()
logger = logging.getLogger("nova.generator")

Mode = Literal["goal", "documents"]
Structure = Literal["chapters", "topics"]
Scope = Literal["narrow", "broad"]

MAX_OBJECTIVE_CHARS = 500
MAX_TITLE_CHARS = 200
MAX_SUMMARY_CHARS = 500
OUTLINE_LIMITS = {"narrow": (3, 3), "broad": (6, 4)}
MAX_PARALLEL_TOPICS = 12
ATTEMPTS = 3
QUIZ_SIZE = 8
PRACTICE_SIZE = 12
MODULE_QUIZ_SIZE = 10

# --- Request ---

class CourseRequest(BaseModel):
    mode: Mode
    level: Level
    objective: str = ""
    focus: str = ""
    structure: Structure = "chapters"

    @field_validator("objective", "focus")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, MAX_OBJECTIVE_CHARS)


@dataclass
class TopicContent:
    lesson: Lesson
    quiz: List[Question]
    practice: List[Question]


# --- Outline ---

class OutlineTopic(BaseModel):
    title: str
    planet: str
    kind: TopicKind = "concept"
    summary: str = ""
    minutes: int = 5

    @field_validator("kind", mode="before")
    @classmethod
    def known_kind(cls, kind: object) -> object:
        return kind if kind in TopicKind.__args__ else "concept"


class OutlineModule(BaseModel):
    title: str
    topics: List[OutlineTopic] = Field(min_length=1)


class Outline(BaseModel):
    title: str
    subtitle: str = ""
    scope: Scope = "broad"
    modules: List[OutlineModule] = Field(min_length=1)

    @field_validator("scope", mode="before")
    @classmethod
    def known_scope(cls, scope: object) -> object:
        return scope if scope in OUTLINE_LIMITS else "broad"


# --- Routes ---

@router.post("/api/courses/generate")
async def generate(
    mode: Mode = Form(...),
    level: Level = Form("beginner"),
    objective: str = Form(""),
    focus: str = Form(""),
    structure: Structure = Form("chapters"),
    files: List[UploadFile] = File(default=[]),
):
    request = CourseRequest(mode=mode, level=level, objective=objective, focus=focus, structure=structure)
    if mode == "goal":
        if len(request.objective) < 3:
            raise HTTPException(422, "Describe what you want to learn")
        course = await _generate_lazy_course(request)
    else:
        pages = await extract_pages(files)
        course = await _generate_full_course(request, pages)
    return course.model_dump(by_alias=True, exclude_none=True)


class TopicRequest(BaseModel):
    level: Level
    objective: str = Field(max_length=MAX_OBJECTIVE_CHARS)
    course: str = Field(max_length=MAX_TITLE_CHARS)
    module: str = Field(max_length=MAX_TITLE_CHARS)
    topic: str = Field(max_length=MAX_TITLE_CHARS)
    summary: str = Field(default="", max_length=MAX_SUMMARY_CHARS)

    @field_validator("objective", "course", "module", "topic", "summary")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, MAX_SUMMARY_CHARS)


@router.post("/api/courses/topic")
async def generate_topic(body: TopicRequest):
    request = CourseRequest(mode="goal", level=body.level, objective=body.objective)
    outline = OutlineTopic(title=body.topic, planet="", summary=body.summary)
    content = await _write_topic(body.module, outline, request, context="")
    seen: set = set()
    return {
        "lesson": content.lesson.model_dump(by_alias=True, exclude_none=True),
        "quiz": [q.model_dump(exclude_none=True) for q in _dedupe_questions(content.quiz, seen)],
        "practice": [q.model_dump(exclude_none=True) for q in _dedupe_questions(content.practice, seen)],
    }


# --- Course flows ---

async def _generate_lazy_course(request: CourseRequest) -> Course:
    """Outline and module quizzes now; each topic is written when the learner opens it."""
    outline = _fit_outline(await _plan_outline(request, context=""))
    quizzes = await asyncio.gather(*(_write_module_quiz(module, request) for module in outline.modules))
    return _assemble_lazy_course(outline, quizzes, request)


async def _generate_full_course(request: CourseRequest, pages: List[Page]) -> Course:
    context = build_context(pages)
    outline = await _plan_outline(request, context)
    topics = await _write_all_topics(outline, request, context)
    return _assemble_course(outline, topics, request, pages)


# --- Model calls ---

T = TypeVar("T", bound=BaseModel)


async def _ask_model(schema: Type[T], system: str, user: str) -> T:
    """Asks for JSON and validates it, retrying when the answer is unusable."""
    for attempt in range(ATTEMPTS):
        try:
            return schema.model_validate(await chat_json(system, user))
        except (ValidationError, ValueError) as error:
            logger.warning("Unusable model answer (attempt %d): %s", attempt + 1, str(error)[:300])
            if attempt == ATTEMPTS - 1:
                raise HTTPException(502, "The course model returned an unusable answer")
    raise AssertionError("unreachable")


async def _plan_outline(request: CourseRequest, context: str) -> Outline:
    return await _ask_model(Outline, outline_system(request.level), _describe_request(request, context))


def _fit_outline(outline: Outline) -> Outline:
    max_modules, max_topics = OUTLINE_LIMITS[outline.scope]
    modules = [module.model_copy(update={"topics": module.topics[:max_topics]}) for module in outline.modules[:max_modules]]
    return outline.model_copy(update={"modules": modules})


async def _write_topic(module_title: str, topic: OutlineTopic, request: CourseRequest, context: str) -> TopicContent:
    grounded = bool(context)
    user = f'{_describe_request(request, context)}\n\nTopic: "{topic.title}" ({topic.summary}) from the module "{module_title}".'
    lesson, quiz, practice = await asyncio.gather(
        _ask_model(Lesson, lesson_system(request.level, grounded), user),
        _ask_model(QuestionList, questions_system(request.level, QUIZ_SIZE, grounded), user),
        _ask_model(QuestionList, questions_system(request.level, PRACTICE_SIZE, grounded), user),
    )
    return TopicContent(lesson, quiz.questions, practice.questions)


async def _write_module_quiz(module: OutlineModule, request: CourseRequest) -> List[Question]:
    system = questions_system(request.level, MODULE_QUIZ_SIZE, grounded=False)
    topics = "\n".join(f"- {topic.title}: {topic.summary}" for topic in module.topics)
    user = f'{_describe_request(request, "")}\n\nEnd-of-module quiz for the module "{module.title}", covering all of its topics:\n{topics}'
    return (await _ask_model(QuestionList, system, user)).questions


async def _write_all_topics(outline: Outline, request: CourseRequest, context: str) -> List[List[TopicContent]]:
    limit = asyncio.Semaphore(MAX_PARALLEL_TOPICS)

    async def write(module: OutlineModule, topic: OutlineTopic) -> TopicContent:
        async with limit:
            return await _write_topic(module.title, topic, request, context)

    jobs = [write(module, topic) for module in outline.modules for topic in module.topics]
    written = iter(await asyncio.gather(*jobs))
    return [[next(written) for _ in module.topics] for module in outline.modules]


def _describe_request(request: CourseRequest, context: str) -> str:
    if request.mode == "goal":
        return wrap_goal(request.objective)
    lines = [f"Build the course from these documents. Structure by {request.structure}."]
    if request.focus:
        lines.append(f"Focus on: {request.focus}")
    return "\n".join(lines) + f"\n\nDocuments:\n{context}"


# --- Assembly ---

def _normalise(question: Question) -> str:
    return re.sub(r"[^a-z0-9]+", " ", question.q.lower()).strip()


def _dedupe_questions(questions: List[Question], seen: set) -> List[Question]:
    unique = []
    for question in questions:
        key = _normalise(question)
        if key not in seen:
            seen.add(key)
            unique.append(question)
    return unique


def _assemble_topic(module_number: int, topic_number: int, outline: OutlineTopic, content: TopicContent) -> Topic:
    seen: set = set()
    return Topic(
        id=f"top-{module_number}-{topic_number}",
        title=outline.title,
        planet=outline.planet,
        kind=outline.kind,
        summary=outline.summary,
        lesson=content.lesson,
        quiz=_dedupe_questions(content.quiz, seen),
        practice=_dedupe_questions(content.practice, seen),
    )


def _assemble_course(outline: Outline, contents: List[List[TopicContent]], request: CourseRequest, pages: List[Page]) -> Course:
    modules = [
        Module(
            id=f"mod-{m}",
            title=module.title,
            topics=[_assemble_topic(m, t, topic, contents[m - 1][t - 1]) for t, topic in enumerate(module.topics, start=1)],
        )
        for m, module in enumerate(outline.modules, start=1)
    ]
    return Course(
        id=f"course-{uuid.uuid4().hex[:8]}",
        title=outline.title,
        subtitle=outline.subtitle,
        objective=request.objective or request.focus or outline.title,
        level=request.level,
        source="documents" if pages else "ai",
        modules=modules,
        documents=_document_summary(pages) if pages else None,
    )


def _assemble_stub(module_number: int, topic_number: int, outline: OutlineTopic) -> TopicStub:
    return TopicStub(
        id=f"top-{module_number}-{topic_number}",
        title=outline.title,
        planet=outline.planet,
        kind=outline.kind,
        summary=outline.summary,
        lesson=LessonStub(minutes=outline.minutes),
    )


def _assemble_lazy_course(outline: Outline, quizzes: List[List[Question]], request: CourseRequest) -> Course:
    modules = [
        Module(
            id=f"mod-{m}",
            title=module.title,
            topics=[_assemble_stub(m, t, topic) for t, topic in enumerate(module.topics, start=1)],
            quiz=_dedupe_questions(quizzes[m - 1], set()),
        )
        for m, module in enumerate(outline.modules, start=1)
    ]
    return Course(
        id=f"course-{uuid.uuid4().hex[:8]}",
        title=outline.title,
        subtitle=outline.subtitle,
        objective=request.objective,
        level=request.level,
        source="ai",
        modules=modules,
    )


def _document_summary(pages: List[Page]) -> List[CourseDocument]:
    counts: dict = {}
    for page in pages:
        counts[page.doc] = counts.get(page.doc, 0) + 1
    return [CourseDocument(name=name, pages=count) for name, count in counts.items()]
