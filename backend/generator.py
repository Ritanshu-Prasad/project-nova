import asyncio
import logging
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from assemble import assemble_course, assemble_lazy_course, dedupe_questions, new_course_id, verify_sources
from cache import COURSES, TOPICS
from chunking import build_topic_context, focus_terms, group_sections
from course_models import Course, Level
from course_requests import CourseRequest, Mode, Structure, TopicRequest
from limits import COURSE_LIMIT, TOPIC_LIMIT
from pdf_parser import Document, read_documents, split_sections
from planning import OutlineTopic, fit_outline, plan_document_outline, plan_outline
from writing import keep_written, write_all_topics, write_module_quiz, write_topic

router = APIRouter()
logger = logging.getLogger("nova.generator")


# --- Routes ---

@router.post("/api/courses/generate", dependencies=[Depends(COURSE_LIMIT)])
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
        course = await _course_from_goal(request)
    else:
        course = await _course_from_documents(request, await read_documents(files))
    return course.model_dump(by_alias=True, exclude_none=True)


@router.post("/api/courses/topic", dependencies=[Depends(TOPIC_LIMIT)])
async def generate_topic(body: TopicRequest):
    key = (body.level, body.objective.casefold(), body.module.casefold(), body.topic.casefold())
    cached = TOPICS.get(key)
    if cached:
        return cached
    request = CourseRequest(mode="goal", level=body.level, objective=body.objective)
    outline = OutlineTopic(title=body.topic, planet="", summary=body.summary)
    content = await write_topic(body.module, outline, request, context="")
    seen: set = set()
    topic = {
        "lesson": content.lesson.model_dump(by_alias=True, exclude_none=True),
        "quiz": [q.model_dump(exclude_none=True) for q in dedupe_questions(content.quiz, seen)],
        "practice": [q.model_dump(exclude_none=True) for q in dedupe_questions(content.practice, seen)],
    }
    TOPICS.set(key, topic)
    return topic


# --- Course flows ---

async def _course_from_goal(request: CourseRequest) -> Course:
    """Outline and module quizzes now; each topic is written when the learner opens it."""
    key = (request.level, request.objective.casefold())
    cached = COURSES.get(key)
    if cached:
        logger.info("Course for %r served from the cache", request.objective)
        return cached.model_copy(update={"id": new_course_id(), "objective": request.objective})
    outline = fit_outline(await plan_outline(request))
    quizzes = await asyncio.gather(*(write_module_quiz(module, request) for module in outline.modules))
    course = assemble_lazy_course(outline, quizzes, request)
    COURSES.set(key, course)
    return course


async def _course_from_documents(request: CourseRequest, documents: List[Document]) -> Course:
    """Documents become a course in one go: one module per group of sections, written from those sections' pages."""
    terms = focus_terms(request.focus)
    groups = group_sections([section for document in documents for section in split_sections(document)], request.structure)
    outline = await plan_document_outline(request, documents, groups, terms)
    contexts = [build_topic_context(group, terms) for group in groups]
    outline, contents = keep_written(outline, await write_all_topics(outline, request, contexts))
    return assemble_course(outline, verify_sources(contents, documents), request, documents)
