import asyncio

from fastapi import HTTPException

from answer_check import agreement
from evals import cases, rows
from evals.metrics import fraction
from placement import MIN_PLACEMENT_QUESTIONS, write_placement


async def check(case: dict) -> dict:
    row = rows.start("placement", case=case["id"])
    try:
        questions = await write_placement(case["goal"])
        difficulties = [question.difficulty for question in questions]
        row.update(ok=True, count=len(questions), valid=len(questions) >= MIN_PLACEMENT_QUESTIONS and difficulties == sorted(difficulties) and max(difficulties) == 3)
        row["agreement"] = await agreement(questions)
    except HTTPException as error:
        row.update(ok=False, valid=False, error=str(error.detail))
    return rows.finish(row)


async def run(which: str) -> list[dict]:
    goals = cases.chosen(cases.load("goals")["goals"], which)
    return list(await asyncio.gather(*(check(case) for case in goals)))


def summarise(result_rows: list[dict]) -> dict:
    answered = [row["agreement"] for row in result_rows if row.get("agreement") is not None]
    return {"runs": len(result_rows), "valid_rate": fraction(result_rows, lambda row: row["valid"]), "agreement": sum(answered) / len(answered) if answered else None}
