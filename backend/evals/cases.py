import json
from pathlib import Path

DIRECTORY = Path(__file__).parent / "cases"


def load(name: str) -> dict:
    return json.loads((DIRECTORY / f"{name}.json").read_text())


def chosen(items: list, which: str) -> list:
    """The `smoke` subset (items marked so) or everything."""
    return [item for item in items if item.get("smoke")] if which == "smoke" else list(items)


def module_cases(which: str) -> list:
    """The module topics, plus every case saved from real problem requests (evals.from_traces), which always run."""
    saved = DIRECTORY / "from_traces.json"
    return chosen(load("modules")["modules"], which) + (json.loads(saved.read_text())["modules"] if saved.exists() else [])
