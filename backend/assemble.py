import re
import time
import uuid
from dataclasses import replace
from typing import List

import llm
import usage
from course_models import Course, CourseDocument, CourseMeta, Lesson, LessonStub, Module, Question, Topic, TopicStub
from course_requests import CourseRequest
from pdf_parser import Document
from planning import Outline, OutlineModule, OutlineTopic
from prompts import PROMPT_VERSION
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
        source="documents",
        modules=modules,
        documents=[CourseDocument(name=document.name, pages=len(document.pages)) for document in documents],
        meta=_meta(),
    )


def assemble_lazy_course(outline: Outline, request: CourseRequest) -> Course:
    """The outline; every topic is an empty placeholder to be written later, and a module's quiz is drawn once its topics are."""
    return Course(
        id=new_course_id(),
        title=outline.title,
        subtitle=outline.subtitle,
        objective=request.objective,
        source="ai",
        modules=lazy_modules(outline.modules),
        meta=_meta(outline),
    )


def lazy_modules(planned: List[OutlineModule]) -> List[Module]:
    """Planned modules as the app holds them before any lesson is written: numbered ids and empty topics."""
    return [
        Module(id=f"mod-{m}", title=module.title, topics=[_stub(m, t, topic) for t, topic in enumerate(module.topics, start=1)])
        for m, module in enumerate(planned, start=1)
    ]


def _meta(outline: Outline | None = None) -> CourseMeta:
    spent = usage.current()
    cost = {"calls": spent.calls, "tokens": spent.tokens, "costUsd": round(spent.cost_usd, 6)} if spent else {}
    planned = {"plannedModules": outline.planned_modules, "plannedTopics": outline.planned_topics} if outline else {}
    return CourseMeta(model=llm.generate_model(), promptVersion=PROMPT_VERSION, createdAt=int(time.time() * 1000), **cost, **planned)


def new_course_id() -> str:
    return f"course-{uuid.uuid4().hex[:8]}"


def _topic(module_number: int, topic_number: int, outline: OutlineTopic, content: TopicContent) -> Topic:
    seen: set = set()
    return Topic(
        id=f"top-{module_number}-{topic_number}",
        title=outline.title,
        planet=outline.planet,
        kind=content.kind,
        summary=outline.summary,
        covers=outline.covers,
        excludes=outline.excludes,
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
        covers=outline.covers,
        excludes=outline.excludes,
        lesson=LessonStub(minutes=outline.minutes),
    )


# --- Citations ---

MATCH_SHARE = 0.8
MIN_KEY_WORDS = 3


def verify_sources(contents: List[List[TopicContent]], documents: List[Document]) -> List[List[TopicContent]]:
    by_name = {document.name: document for document in documents}
    return [[replace(content, lesson=_verified_lesson(content.lesson, by_name)) for content in module] for module in contents]


def _verified_lesson(lesson: Lesson, documents: dict) -> Lesson:
    """Keeps citations honest: a source block must quote text that is really in the document it names."""
    blocks = [block for block in (_verified_block(block, documents) for block in lesson.blocks) if block is not None]
    return lesson.model_copy(update={"blocks": blocks})


def _verified_block(block, documents: dict):
    if block.type != "source":
        return block
    document = documents.get(block.doc) or (next(iter(documents.values())) if len(documents) == 1 else None)
    page = _find_excerpt(block.excerpt, document, block.page) if document else None
    if page is None:
        return None
    return block.model_copy(update={"doc": document.name, "page": page})


def _find_excerpt(excerpt: str, document: Document, cited: int | None) -> int | None:
    """The page that holds the excerpt: the cited one if it does, otherwise the best other page, otherwise none."""
    scores = {page.number: _share_found(excerpt, page.text) for page in document.pages}
    if not scores:
        return None
    if scores.get(cited, 0) >= MATCH_SHARE:
        return cited
    best = max(scores, key=scores.get)
    return best if scores[best] >= MATCH_SHARE else None


def _share_found(excerpt: str, page_text: str) -> float:
    wanted = _words(excerpt)
    if len(wanted) < MIN_KEY_WORDS:
        return float(_plain(excerpt) in _plain(page_text))
    return len(wanted & _words(page_text)) / len(wanted)


def _words(text: str) -> set:
    return set(re.findall(r"[a-z0-9]{4,}", text.lower()))


def _plain(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))
