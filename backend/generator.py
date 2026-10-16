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

router = APIRouter()
logger = logging.getLogger("nova.generator")

Mode = Literal["goal", "documents"]
Structure = Literal["chapters", "topics"]

MAX_OBJECTIVE_CHARS = 500
MAX_PARALLEL_TOPICS = 12
ATTEMPTS = 3
QUIZ_SIZE = 8
PRACTICE_SIZE = 12
MODULE_QUIZ_SIZE = 10

# --- Prompts ---

LEVEL_HINTS = {
    "beginner": "The learner is a complete novice. Use plain language and everyday analogies, avoid heavy math, and test core intuition.",
    "intermediate": "The learner knows the basics. Be applied and mechanism-oriented, use standard equations and realistic code, and test edge cases.",
    "advanced": "The learner is a specialist. Be rigorous, cover internals and failure modes, and test subtle trade-offs and multi-step reasoning.",
}

OUTLINE_PROMPT = """You are a senior curriculum architect. Design a course as JSON:
{"title": str, "subtitle": str, "modules": [{"title": str, "topics": [
  {"title": str, "planet": str, "kind": "concept|programming|math|science|humanities|language|document", "summary": str, "minutes": int}]}]}

Rules:
- Size the course to the subject: 3 to 6 modules of 2 to 4 topics each. Modules follow a learning arc from foundations to advanced use.
- "planet" is a short, unique, star-like name for the topic on a journey map (for example Vega, Lyra, Mira).
- Module titles carry no numbering. "summary" is one sentence. "minutes" is 5 to 8.
- {level_hint}
Reply with JSON only."""

LESSON_PROMPT = """You are a master textbook author. Write the lesson for one course topic as JSON:
{"minutes": int, "objectives": [str], "simple": str, "blocks": [Block]}

Block is one of:
{"type":"text","title":str,"body":str} {"type":"analogy","body":str}
{"type":"keyTerms","terms":[{"term":str,"def":str}]} {"type":"steps","title":str,"steps":[str]}
{"type":"code","language":str,"code":str,"caption":str} {"type":"formula","expr":str,"caption":str}
{"type":"compare","title":str,"columns":[str,str],"rows":[[label,colA,colB]]} {"type":"example","title":str,"body":str}
{"type":"callout","tone":"tip|warning|fact","body":str} {"type":"source","doc":str,"page":int,"excerpt":str}
{"type":"summary","points":[str]}

Rules:
- 4 objectives starting with a verb, a one-paragraph "simple" summary, and 8 to 10 blocks that include text, an example, keyTerms (at least 4) and a closing summary.
- Write like a textbook, not a chatbot: concrete, specific, no filler. Keep each block under 120 words and code under 25 lines. Use **bold** for key terms, plain unicode for math, no LaTeX.
- {level_hint}
- {source_hint}
Reply with JSON only."""

QUESTIONS_PROMPT = """You are an expert assessment writer. Write {count} questions for one course topic as JSON:
{"questions": [Question]}

Question is one of (every question has "q", "why" explaining the answer, "difficulty" 1 to 3):
{"type":"mcq","options":[4 strs],"answer":index} {"type":"multi","options":[4 strs],"answers":[indexes]}
{"type":"truefalse","answer":bool} {"type":"fill","answer":str,"accept":[str]} with the blank written as ____ in "q"
{"type":"code","language":str,"starter":str,"solution":str,"checks":[{"label":str,"pattern":JavaScript regex}]}
{"type":"order","items":[strs in correct order]} {"type":"match","pairs":[[left,right]]}

Rules:
- Write exactly {count} questions. Mix question types and difficulties, favour real scenarios over memorised definitions, keep "why" to one sentence, keep code questions under 15 lines, and never repeat a question.
- {level_hint}
- {source_hint}
Reply with JSON only."""

GOAL_SOURCE_HINT = "Do not include source blocks."
DOCUMENT_SOURCE_HINT = "Ground the content in the provided document excerpts and include source blocks quoting them with the exact doc name and page."


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
        return re.sub(r"[\x00-\x1f\x7f]+", " ", text).strip()[:MAX_OBJECTIVE_CHARS]


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
    modules: List[OutlineModule] = Field(min_length=1)


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
    course: str = Field(max_length=200)
    module: str = Field(max_length=200)
    topic: str = Field(max_length=200)
    summary: str = Field(default="", max_length=500)


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
    outline = await _plan_outline(request, context="")
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
    system = OUTLINE_PROMPT.replace("{level_hint}", LEVEL_HINTS[request.level])
    return await _ask_model(Outline, system, _describe_request(request, context))


async def _write_topic(module_title: str, topic: OutlineTopic, request: CourseRequest, context: str) -> TopicContent:
    source_hint = DOCUMENT_SOURCE_HINT if context else GOAL_SOURCE_HINT
    user = f'{_describe_request(request, context)}\n\nTopic: "{topic.title}" ({topic.summary}) from the module "{module_title}".'

    def system(prompt: str, count: int = 0) -> str:
        return (
            prompt.replace("{level_hint}", LEVEL_HINTS[request.level])
            .replace("{source_hint}", source_hint)
            .replace("{count}", str(count))
        )

    lesson, quiz, practice = await asyncio.gather(
        _ask_model(Lesson, system(LESSON_PROMPT), user),
        _ask_model(QuestionList, system(QUESTIONS_PROMPT, QUIZ_SIZE), user),
        _ask_model(QuestionList, system(QUESTIONS_PROMPT, PRACTICE_SIZE), user),
    )
    return TopicContent(lesson, quiz.questions, practice.questions)


async def _write_module_quiz(module: OutlineModule, request: CourseRequest) -> List[Question]:
    system = (
        QUESTIONS_PROMPT.replace("{level_hint}", LEVEL_HINTS[request.level])
        .replace("{source_hint}", GOAL_SOURCE_HINT)
        .replace("{count}", str(MODULE_QUIZ_SIZE))
    )
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
        return f"Learning goal: {request.objective}"
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
