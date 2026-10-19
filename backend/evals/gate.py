import json
from dataclasses import dataclass
from fnmatch import fnmatch
from pathlib import Path


@dataclass(frozen=True)
class Violation:
    metric: str
    rule: str
    value: float
    limit: float
    baseline: float | None = None

    def describe(self) -> str:
        base = f" (baseline {self.baseline})" if self.baseline is not None else ""
        return f"{self.metric} = {self.value}, but {self.rule} {self.limit}{base}"


def load_rules(path: Path) -> list[dict]:
    return json.loads(path.read_text())["rules"]


def flatten(summary: dict, prefix: str = "") -> dict[str, float]:
    """The numbers of a summary under dotted names, e.g. goals.beginner.ok or safety.recall."""
    flat: dict[str, float] = {}
    for name, value in summary.items():
        path = f"{prefix}{name}"
        if isinstance(value, dict):
            flat.update(flatten(value, path + "."))
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            flat[path] = value
    return flat


def check(current: dict[str, float], baseline: dict[str, float], rules: list[dict]) -> list[Violation]:
    """Every rule broken by the current numbers; a rule only applies to metrics that exist (a suite that was not run is skipped)."""
    violations = []
    for rule in rules:
        for metric in sorted(name for name in current if fnmatch(name, rule["metric"])):
            violation = _violation(metric, current[metric], baseline.get(metric), rule)
            if violation:
                violations.append(violation)
    return violations


def _violation(metric: str, value: float, baseline: float | None, rule: dict) -> Violation | None:
    if "at_least" in rule and value < rule["at_least"]:
        return Violation(metric, "must be at least", value, rule["at_least"])
    if "at_most" in rule and value > rule["at_most"]:
        return Violation(metric, "must be at most", value, rule["at_most"])
    if baseline is None:
        return None
    if "drop_at_most" in rule and baseline - value > rule["drop_at_most"]:
        return Violation(metric, "may fall at most", value, rule["drop_at_most"], baseline)
    if "rise_at_most_share" in rule and baseline > 0 and (value - baseline) / baseline > rule["rise_at_most_share"]:
        return Violation(metric, "may rise by at most (share)", value, rule["rise_at_most_share"], baseline)
    return None
