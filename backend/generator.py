import asyncio
import hashlib
import json
import logging
import time
from typing import AsyncIterator, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from assemble import assemble_course, assemble_lazy_course, dedupe_questions, new_course_id, verify_sources
from cache import BANKS, COURSES, TOPICS
from chunking import build_topic_context, focus_terms, group_sections
from course_models import Course
from course_requests import CourseRequest, Mode, ModuleQuizRequest, Structure, TopicRequest
from document_store import delete_pages, is_valid_key, save_pages
from limits import COURSE_LIMIT, TOPIC_LIMIT
from pdf_parser import Document, read_documents, split_sections
from placement import PlacementRequest, PlacementResult, starting_point, write_placement
from planning import OutlineTopic, fit_outline, plan_document_outline, plan_outline
from progress import Report, ignore
from safety import check_goal, refuse_orders
import traces
import usage
from request_context import request_id_var
from usage import check_budget
from writing import bank_key, keep_written, module_quiz, write_all_topics, write_topic

router = APIRouter()
STREAM_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
logger = logging.getLogger("nova.generator")


# --- Routes ---

@router.post("/api/courses/generate", dependencies=[Depends(COURSE_LIMIT), Depends(check_budget)])
async def generate(
    mode: Mode = Form(...),
    expectations: str = Form(""),
    objective: str = Form(""),
    focus: str = Form(""),
    structure: Structure = Form("chapters"),
    files: List[UploadFile] = File(default=[]),
    fresh: bool = Query(False),
):
    request, documents = await _read_request(mode, expectations, objective, focus, structure, files)
    return await _make_course(request, documents, fresh)


@router.post("/api/courses/generate/stream", dependencies=[Depends(COURSE_LIMIT), Depends(check_budget)])
async def generate_stream(
    mode: Mode = Form(...),
    expectations: str = Form(""),
    objective: str = Form(""),
    focus: str = Form(""),
    structure: Structure = Form("chapters"),
    files: List[UploadFile] = File(default=[]),
    fresh: bool = Query(False),
):
    """The same course, sent as one JSON event per line: progress steps, then the course (or an error)."""
    request, documents = await _read_request(mode, expectations, objective, focus, structure, files)
    return StreamingResponse(_course_events(request, documents, fresh), media_type="application/x-ndjson", headers=STREAM_HEADERS)


async def _read_request(mode, expectations, objective, focus, structure, files) -> tuple[CourseRequest, List[Document]]:
    request = CourseRequest(mode=mode, objective=objective, expectations=expectations, focus=focus, structure=structure)
    refuse_orders(request.expectations)
    if mode == "goal":
        if len(request.objective) < 3:
            raise HTTPException(422, "Describe what you want to learn")
        return request, []
    return request, await read_documents(files)


@router.post("/api/courses/topic", dependencies=[Depends(TOPIC_LIMIT), Depends(check_budget)])
async def generate_topic(body: TopicRequest, fresh: bool = Query(False)):
    refuse_orders(body.expectations)
    key = (body.objective.casefold(), body.expectations.casefold(), body.module.casefold(), body.topic.casefold(), body.outline, body.previous)
    cached = None if fresh else await TOPICS.get(key)
    if cached:
        return cached
    request = CourseRequest(mode="goal", objective=body.objective, expectations=body.expectations)
    outline = OutlineTopic(title=body.topic, planet="", summary=body.summary)
    content = await write_topic(body.module, outline, request, "", body.outline, body.previous)
    seen: set = set()
    topic = {
        "lesson": content.lesson.model_dump(by_alias=True, exclude_none=True),
        "quiz": [q.model_dump(exclude_none=True) for q in dedupe_questions(content.quiz, seen)],
        "practice": [q.model_dump(exclude_none=True) for q in dedupe_questions(content.practice, seen)],
    }
    await TOPICS.put(key, topic)
    return topic


@router.post("/api/courses/module-quiz", dependencies=[Depends(TOPIC_LIMIT), Depends(check_budget)])
async def generate_module_quiz(body: ModuleQuizRequest):
    """The module's quiz, drawn from the question banks of the topics the learner was taught; empty when those banks are gone, and the app then builds one from its topics."""
    banks = [bank for taught in body.topics if (bank := await BANKS.get(bank_key(body.objective, body.module, taught.title)))]
    return {"quiz": [q.model_dump(exclude_none=True) for q in dedupe_questions(await module_quiz(banks), set())] if banks else []}


@router.post("/api/courses/placement", dependencies=[Depends(TOPIC_LIMIT), Depends(check_budget)])
async def generate_placement(body: PlacementRequest, fresh: bool = Query(False)):
    """Five multiple-choice questions, easy to hard, for a learner who is unsure what to expect of the course."""
    if len(body.objective) < 3:
        raise HTTPException(422, "Describe what you want to learn")
    key = ("placement", body.objective.casefold())
    cached = None if fresh else await TOPICS.get(key)
    if cached:
        return cached
    questions = await _while_checking(body.objective, write_placement(body.objective))
    result = {"questions": [question.model_dump(exclude_none=True) for question in questions]}
    await TOPICS.put(key, result)
    return result


@router.post("/api/courses/placement/note", dependencies=[Depends(TOPIC_LIMIT)])
async def placement_note(body: PlacementResult):
    """A sentence about where the learner starts, for the course expectations."""
    return {"note": starting_point(body.answers)}


@router.delete("/api/courses/documents/{key}")
async def forget_documents(key: str):
    """Deletes the page text kept for a course's tutor; the key is the secret that came with the course."""
    if not is_valid_key(key):
        raise HTTPException(422, "That is not a document key")
    await delete_pages(key)
    return {"deleted": True}


# --- Course flows ---

async def _make_course(request: CourseRequest, documents: List[Document], fresh: bool, report: Report = ignore) -> dict:
    if request.mode == "goal":
        return await _course_from_goal(request, fresh, report)
    return _dump(await _course_from_documents(request, documents, report))


async def _course_events(request: CourseRequest, documents: List[Document], fresh: bool) -> AsyncIterator[str]:
    """Runs the course in the background and passes its progress on as it happens; leaving stops the work."""
    events: asyncio.Queue = asyncio.Queue()

    def report(stage: str, detail: str = "") -> None:
        events.put_nowait({"type": "progress", "stage": stage, "detail": detail})

    async def run() -> None:
        try:
            events.put_nowait({"type": "course", "course": await _make_course(request, documents, fresh, report)})
        except HTTPException as error:
            events.put_nowait({"type": "error", "status": error.status_code, "detail": error.detail})
        except Exception:
            logger.exception("Course generation failed")
            events.put_nowait({"type": "error", "status": 500, "detail": "Something went wrong while writing the course"})
        finally:
            events.put_nowait(None)

    started = time.perf_counter()
    job = asyncio.create_task(run())
    try:
        while (event := await events.get()) is not None:
            yield json.dumps(event) + "\n"
    finally:
        job.cancel()
        if spent := usage.current():
            logger.info("Course stream ended [%s]", spent.describe())
            await _save_stream_trace(spent, time.perf_counter() - started)


async def _save_stream_trace(spent, seconds: float) -> None:
    """A stream answers before its model calls are done, so its request record is saved here, when the last of them has finished."""
    try:
        await traces.save(traces.build_record(spent, request_id_var.get(), "POST", "/api/courses/generate/stream", 200, seconds))
    except asyncio.CancelledError:
        pass


async def _course_from_goal(request: CourseRequest, fresh: bool, report: Report) -> dict:
    """The outline now; each topic, with its question bank, is written when the learner opens it."""
    key = (request.objective.casefold(), request.expectations.casefold())
    cached = None if fresh else await COURSES.get(key)
    if cached:
        logger.info("Course %s served from the cache", _fingerprint(request.objective))
        return {**cached, "id": new_course_id(), "objective": request.objective}
    outline = fit_outline(await _while_checking(f"{request.objective} {request.expectations}", plan_outline(request, report)))
    course = _dump(assemble_lazy_course(outline, request))
    await COURSES.put(key, course)
    return course


async def _course_from_documents(request: CourseRequest, documents: List[Document], report: Report) -> Course:
    """Documents become a course in one go: one module per group of sections, written from those sections' pages."""
    terms = focus_terms(request.focus)
    groups = group_sections([section for document in documents for section in split_sections(document)], request.structure)
    outline = await plan_document_outline(request, documents, groups, terms, report)
    contexts = [build_topic_context(group, terms) for group in groups]
    outline, contents = keep_written(outline, await write_all_topics(outline, request, contexts, report))
    course = assemble_course(outline, verify_sources(contents, documents), request, documents)
    key = await save_pages(documents)
    return course.model_copy(update={"meta": course.meta.model_copy(update={"documentsKey": key})})


def _dump(course: Course) -> dict:
    return course.model_dump(by_alias=True, exclude_none=True)


async def _while_checking(goal: str, work):
    """Runs `work` while the goal is checked, so the check adds no waiting; a refused goal cancels the work."""
    check, job = asyncio.create_task(check_goal(goal)), asyncio.ensure_future(work)
    try:
        await check
    except BaseException:
        job.cancel()
        raise
    return await job


def _fingerprint(text: str) -> str:
    """A short stand-in for a goal in logs, so what learners type is not written to them."""
    return hashlib.sha1(text.casefold().encode()).hexdigest()[:8]
