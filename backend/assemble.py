import re
import uuid
from dataclasses import replace
from typing import List

from course_models import Course, CourseDocument, Lesson, LessonStub, Module, Question, Topic, TopicStub
from course_requests import CourseRequest
from pdf_parser import Document
from planning import Outline, OutlineTopic
from writing import TopicContent


# --- Questions ---

def dedupe_questions(questions: List[Question], seen: set) -> List[Question]:
    """Drops questions worded like one already in `seen`, which is filled in as it goes."""
    unique = []
    for question in questions:
        key = re.sub(r"[^a-z0-9]+", " ", question.q.lower()).strip()
        if key not in seen:
            seen.add(key)
            unique.append(question)
    return unique


# --- Courses ---

def assemble_course(outline: Outline, contents: List[List[TopicContent]], request: CourseRequest, documents: List[Document]) -> Course:
    modules = [
        Module(
            id=f"mod-{m}",
            title=module.title,
            topics=[_topic(m, t, topic, contents[m - 1][t - 1]) for t, topic in enumerate(module.topics, start=1)],
        )
        for m, module in enumerate(outline.modules, start=1)
    ]
    return Course(
        id=new_course_id(),
        title=outline.title,
        subtitle=outline.subtitle,
        objective=request.objective or request.focus or outline.title,
        level=request.level,
        source="documents",
        modules=modules,
        documents=[CourseDocument(name=document.name, pages=len(document.pages)) for document in documents],
    )


def assemble_lazy_course(outline: Outline, quizzes: List[List[Question]], request: CourseRequest) -> Course:
    """The outline with its module quizzes; every topic is an empty placeholder to be written later."""
    modules = [
        Module(
            id=f"mod-{m}",
            title=module.title,
            topics=[_stub(m, t, topic) for t, topic in enumerate(module.topics, start=1)],
            quiz=dedupe_questions(quizzes[m - 1], set()),
        )
        for m, module in enumerate(outline.modules, start=1)
    ]
    return Course(
        id=new_course_id(),
        title=outline.title,
        subtitle=outline.subtitle,
        objective=request.objective,
        level=request.level,
        source="ai",
        modules=modules,
    )


def new_course_id() -> str:
    return f"course-{uuid.uuid4().hex[:8]}"


def _topic(module_number: int, topic_number: int, outline: OutlineTopic, content: TopicContent) -> Topic:
    seen: set = set()
    return Topic(
        id=f"top-{module_number}-{topic_number}",
        title=outline.title,
        planet=outline.planet,
        kind=outline.kind,
        summary=outline.summary,
        lesson=content.lesson,
        quiz=dedupe_questions(content.quiz, seen),
        practice=dedupe_questions(content.practice, seen),
    )


def _stub(module_number: int, topic_number: int, outline: OutlineTopic) -> TopicStub:
    return TopicStub(
        id=f"top-{module_number}-{topic_number}",
        title=outline.title,
        planet=outline.planet,
        kind=outline.kind,
        summary=outline.summary,
        lesson=LessonStub(minutes=outline.minutes),
    )


# --- Citations ---

def verify_sources(contents: List[List[TopicContent]], documents: List[Document]) -> List[List[TopicContent]]:
    pages = {document.name: len(document.pages) for document in documents}
    return [[replace(content, lesson=_verified_lesson(content.lesson, pages)) for content in module] for module in contents]


def _verified_lesson(lesson: Lesson, pages: dict) -> Lesson:
    """Keeps citations honest: a source block must name an uploaded document and an existing page."""
    blocks = [block for block in (_verified_block(block, pages) for block in lesson.blocks) if block is not None]
    return lesson.model_copy(update={"blocks": blocks})


def _verified_block(block, pages: dict):
    if block.type != "source":
        return block
    doc = block.doc if block.doc in pages else next(iter(pages)) if len(pages) == 1 else None
    if doc is None:
        return None
    page = block.page if block.page and block.page <= pages[doc] else None
    return block.model_copy(update={"doc": doc, "page": page})
