import asyncio

from fastapi import HTTPException

from evals import cases, rows
from evals.metrics import fraction
from module_content import write_module
from question_bank import write_bank


async def check(case: dict) -> dict:
    """Writes a module and its question bank, and records how clean the model's first answer was."""
    row = rows.start("bank", case=case["id"])
    first_pass: dict = {}
    try:
        content = await write_module(case["topic"], case["expectations"], [])
        bank = await write_bank(content, first_pass)
        row.update(ok=True, questions=len(bank.questions))
    except HTTPException as error:
        row.update(ok=False, error=str(error.detail))
    problems = {key: reason for key, reason in first_pass.get("problems", {}).items() if key != "bank"}
    if first_pass:
        row["clean_share"] = 1 - len(problems) / first_pass["questions"]
    return rows.finish(row)


async def run(which: str) -> list[dict]:
    topics = cases.module_cases(which)
    return list(await asyncio.gather(*(check(case) for case in topics)))


def summarise(result_rows: list[dict]) -> dict:
    judged = [row["clean_share"] for row in result_rows if "clean_share" in row]
    return {
        "runs": len(result_rows),
        "ok_rate": fraction(result_rows, lambda row: row["ok"]),
        "clean_share": sum(judged) / len(judged) if judged else None,
        "first_try": sum(row["first_try"] for row in result_rows) / len(result_rows) if result_rows else None,
    }
