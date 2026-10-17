import asyncio
import io

from fastapi import HTTPException, UploadFile

import generator
from answer_check import agreement
from course_models import Lesson
from course_requests import CourseRequest
from evals import cases, rows
from evals.judge import judge_lesson, judge_questions
from evals.metrics import citation_survival, duplicate_rate, grade_in_range, reading_grade, type_mix
from evals.pdfs import make_pdf
from pdf_parser import read_documents
from planning import fit_outline, plan_outline
from progress import ignore
from writing import write_topic

PARALLEL_RUNS = 3


# --- One run ---

async def run_goal(case: dict, level: str, judge: bool) -> dict:
    """Plans a course for the goal and writes its first topic at one level."""
    request = CourseRequest(mode="goal", level=level, objective=case["goal"])
    row = rows.start("goals", kind="goal", case=case["id"], level=level)
    try:
        outline = fit_outline(await plan_outline(request))
        module, topic = outline.modules[0], outline.modules[0].topics[0]
        titles = [t.title for m in outline.modules for t in m.topics]
        content = await write_topic(module.title, topic, request, "", titles, "")
        text = lesson_text(content.lesson)
        questions = content.quiz + content.practice
        grade = reading_grade(text)
        row.update(ok=True, text=text, grade=grade, grade_ok=grade_in_range(grade, level), duplicates=duplicate_rate(questions), mix=type_mix(questions), questions=len(questions))
        row["agreement"] = await agreement(content.quiz, level)
        if judge:
            scores = await judge_lesson(case["goal"], level, content.lesson.objectives, text)
            question_scores = await judge_questions(case["goal"], level, [q.q for q in questions])
            row.update(judge=scores.average, judge_notes=scores.notes, questions_judge=question_scores.average, questions_notes=question_scores.notes)
    except HTTPException as error:
        row.update(ok=False, error=str(error.detail))
    return rows.finish(row)


async def run_document(case: dict, level: str) -> dict:
    """Builds a whole course from a small document and checks how many quotes were really in it."""
    request = CourseRequest(mode="documents", level=level)
    row = rows.start("goals", kind="document", case=case["id"], level=level)
    quotes = {"before": 0, "after": 0}
    real_verify = generator.verify_sources

    def counting(contents, documents):
        quotes["before"] = sum(1 for module in contents for c in module for b in c.lesson.blocks if b.type == "source")
        checked = real_verify(contents, documents)
        quotes["after"] = sum(1 for module in checked for c in module for b in c.lesson.blocks if b.type == "source")
        return checked

    generator.verify_sources = counting
    try:
        upload = UploadFile(file=io.BytesIO(make_pdf(case["pages"])), filename=case["name"])
        course = await generator._course_from_documents(request, await read_documents([upload]), ignore)
        topics = [t for m in course.modules for t in m.topics]
        text = " ".join(lesson_text(t.lesson) for t in topics)
        questions = [q for t in topics for q in t.quiz + t.practice]
        row.update(ok=True, modules=len(course.modules), topics=len(topics), grade=reading_grade(text), duplicates=duplicate_rate(questions), mix=type_mix(questions), citations=citation_survival(quotes["before"], quotes["after"]))
    except HTTPException as error:
        row.update(ok=False, error=str(error.detail))
    finally:
        generator.verify_sources = real_verify
    return rows.finish(row)


def lesson_text(lesson: Lesson) -> str:
    parts = [lesson.simple]
    for block in lesson.blocks:
        parts += [getattr(block, "body", "")] + list(getattr(block, "points", []))
    return " ".join(part for part in parts if part)


# --- Many runs ---

async def run(which: str, judge: bool, repeat: int) -> list[dict]:
    goals, documents = cases.load("goals"), cases.load("documents")
    gate = asyncio.Semaphore(PARALLEL_RUNS)

    async def limited(coroutine):
        async with gate:
            return await coroutine

    jobs = [limited(run_goal(case, level, judge)) for _ in range(repeat) for case in cases.chosen(goals["goals"], which) for level in goals["levels"]]
    jobs += [limited(run_document(case, "intermediate")) for case in cases.chosen(documents["documents"], which)]
    return list(await asyncio.gather(*jobs))
