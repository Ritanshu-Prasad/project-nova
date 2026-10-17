import json
from pathlib import Path

DIRECTORY = Path(__file__).parent / "cases"


def load(name: str) -> dict:
    return json.loads((DIRECTORY / f"{name}.json").read_text())


def chosen(items: list, which: str) -> list:
    """The `smoke` subset (items marked so) or everything."""
    return [item for item in items if item.get("smoke")] if which == "smoke" else list(items)
