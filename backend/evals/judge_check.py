"""Checks the model that grades lessons against a person's grades, since it is the same model that wrote them.

    python -m evals.judge_check --prepare 20     # writes lessons for you to rate to evals/cases/judged_labels.json
    (open the file and set "human" to a number from 1 (bad) to 5 (excellent) on each item)
    python -m evals.judge_check                  # compares the judge's scores with yours
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

from evals import cases
from evals.goal_eval import lesson_text
from evals.judge import judge_lesson
from evals.metrics import judge_agreement
from course_requests import CourseRequest
from planning import fit_outline, plan_outline
from writing import write_topic

LABELS = Path(__file__).parent / "cases" / "judged_labels.json"
PARALLEL = 3


async def prepare_item(goal: dict, style: dict) -> dict | None:
    """One lesson for a goal and a kind of expectation, with the judge's score and an empty slot for yours."""
    request = CourseRequest(mode="goal", objective=goal["goal"], expectations=style["expectations"])
    try:
        outline = fit_outline(await plan_outline(request))
        module, topic = outline.modules[0], outline.modules[0].topics[0]
        content = await write_topic(module.title, topic, request, "", [t.title for m in outline.modules for t in m.topics], "")
    except Exception:
        return None
    text = lesson_text(content.lesson)
    scores = await judge_lesson(goal["goal"], style["expectations"], content.lesson.objectives, text)
    return {"id": f"{goal['id']}-{style['id']}", "goal": goal["goal"], "expectations": style["expectations"], "lesson": text, "questions": [q.q for q in content.quiz + content.practice],
            "judge": round(scores.average, 2), "judge_notes": scores.notes, "human": None}


async def prepare(count: int) -> int:
    goals, styles = cases.load("goals")["goals"], cases.load("goals")["styles"]
    pairs = [(goal, style) for goal in goals for style in styles][:count]
    gate = asyncio.Semaphore(PARALLEL)

    async def limited(goal, style):
        async with gate:
            return await prepare_item(goal, style)

    items = [item for item in await asyncio.gather(*(limited(goal, style) for goal, style in pairs)) if item]
    LABELS.write_text(json.dumps({"items": items}, indent=2, ensure_ascii=False) + "\n")
    return len(items)


def compare(path: Path | None = None) -> dict:
    """The judge against a person, over the items that have a human score."""
    items = json.loads((path or LABELS).read_text())["items"]
    return judge_agreement([(item["judge"], item["human"]) for item in items if item.get("human") is not None])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prepare", type=int, metavar="COUNT", help="write COUNT lessons to rate")
    args = parser.parse_args(argv)
    if args.prepare:
        print(f"{asyncio.run(prepare(args.prepare))} lesson(s) written to {LABELS}; set \"human\" from 1 to 5 on each, then run again without --prepare")
        return 0
    result = compare()
    if not result["items"]:
        print(f"No item in {LABELS} has a human score yet.")
        return 1
    print("\n".join(f"{name}: {value:.2f}" if isinstance(value, float) else f"{name}: {value}" for name, value in result.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
