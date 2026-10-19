from typing import Callable

# Reports one step of a long job: (stage, short description).
Report = Callable[[str, str], None]


def ignore(stage: str, detail: str = "") -> None:
    """The report used when nobody is listening."""
