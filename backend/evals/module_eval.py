import asyncio

from fastapi import HTTPException

from evals import cases, rows
from evals.metrics import fraction, repeated_extras, sections_with_lists, simple_grade
from module_content import needs_code, write_module


async def check(case: dict) -> dict:
    """Asks whether the topic needs code, then writes its module under the answer."""
    row = rows.start("modules", case=case["id"], expected=case["requires_code"])
    try:
        row["decided"] = await needs_code(case["topic"], case["expectations"])
        content = await write_module(case["topic"], case["expectations"], [])
        row.update(ok=True, requires_code=content.requires_code, sections=len(content.sections), code_sections=sum(1 for section in content.sections if section.code), repeated_extras=repeated_extras(content), sections_with_lists=sections_with_lists(content), simple_grade=simple_grade(content))
    except HTTPException as error:
        row.update(ok=False, error=str(error.detail))
    return rows.finish(row)


async def run(which: str) -> list[dict]:
    topics = cases.module_cases(which)
    return list(await asyncio.gather(*(check(case) for case in topics)))


def summarise(result_rows: list[dict]) -> dict:
    """Cases whose expected decision is null are ambiguous and are not scored."""
    clear = [row for row in result_rows if row["expected"] is not None]
    written = [row for row in clear if row["ok"]]
    done = [row for row in result_rows if row["ok"]]
    return {
        "runs": len(result_rows),
        "ok_rate": fraction(result_rows, lambda row: row["ok"]),
        "decision_accuracy": fraction([row for row in clear if "decided" in row], lambda row: row["decided"] == row["expected"]),
        "code_when_needed": fraction([row for row in written if row["expected"]], lambda row: row["code_sections"] > 0),
        "no_code_when_not_needed": fraction([row for row in written if not row["expected"]], lambda row: row["code_sections"] == 0),
        "average_sections": sum(row["sections"] for row in done) / len(done) if done else None,
        "repeated_extras": sum(row["repeated_extras"] for row in done),
        "sections_with_lists": sum(row["sections_with_lists"] for row in done) / len(done) if done else None,
        "simple_grade": sum(row["simple_grade"] for row in done) / len(done) if done else None,
    }
