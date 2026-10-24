import asyncio

from fastapi import HTTPException

from course_requests import CourseRequest
from evals import cases, rows
from evals.metrics import fraction, topic_overlap
from planning import fit_outline, plan_outline

PARALLEL_RUNS = 3


async def check(goal: dict, style: dict) -> dict:
    """Plans a course for one goal and one kind of expectation, and records how big the plan is."""
    request = CourseRequest(mode="goal", objective=goal["goal"], expectations=style["expectations"])
    row = rows.start("outline", case=goal["id"], style=style["id"])
    try:
        outline = fit_outline(await plan_outline(request))
        overlap = topic_overlap([topic.summary for module in outline.modules for topic in module.topics])
        row.update(ok=True, modules=len(outline.modules), topics=sum(len(module.topics) for module in outline.modules), planned_modules=outline.planned_modules, planned_topics=outline.planned_topics, topic_overlap=overlap)
    except HTTPException as error:
        row.update(ok=False, error=str(error.detail))
    return rows.finish(row)


async def run(which: str) -> list[dict]:
    plan = cases.load("goals")
    gate = asyncio.Semaphore(PARALLEL_RUNS)

    async def limited(goal, style):
        async with gate:
            return await check(goal, style)

    return list(await asyncio.gather(*(limited(goal, style) for goal in cases.chosen(plan["goals"], which) for style in plan["styles"])))


def summarise(result_rows: list[dict]) -> dict:
    """Average size per kind of expectation, and how often a goal's overview plan is no bigger than its deep plan."""
    done = [row for row in result_rows if row["ok"]]
    by_style: dict[str, dict] = {}
    for style in dict.fromkeys(row["style"] for row in done):
        mine = [row for row in done if row["style"] == style]
        by_style[style] = {"modules": sum(row["modules"] for row in mine) / len(mine), "topics": sum(row["topics"] for row in mine) / len(mine)}
    cases_seen = {row["case"] for row in done}
    pairs = {case: {row["style"]: row["topics"] for row in done if row["case"] == case} for case in cases_seen}
    comparable = [sizes for sizes in pairs.values() if "overview" in sizes and "deep" in sizes]
    overlaps = [row["topic_overlap"] for row in done if row["topic_overlap"] is not None]
    return {
        "runs": len(result_rows),
        "ok_rate": fraction(result_rows, lambda row: row["ok"]),
        "styles": by_style,
        "size_follows_style": fraction(comparable, lambda sizes: sizes["overview"] <= sizes["deep"]),
        "trimmed": fraction(done, lambda row: row["planned_modules"] > row["modules"] or row["planned_topics"] > row["topics"]),
        "topic_overlap": sum(overlaps) / len(overlaps) if overlaps else None,
    }
