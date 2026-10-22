import re
from typing import Annotated

from pydantic import BeforeValidator

HYPHENS = dict.fromkeys(map(ord, "‐‑‒"), "-")
QUOTES = {ord("“"): '"', ord("”"): '"', ord("‘"): "'", ord("’"): "'"}
SPACES = dict.fromkeys(map(ord, "    "), " ")
DASH_BETWEEN_DIGITS = re.compile(r"(?<=\d)\s*[–—]\s*(?=\d)")
DASH = re.compile(r"\s*[–—]\s*")
NUMBERING = re.compile(r"^\s*(?:step\s+)?\d+\s*[.):\-]\s*", re.IGNORECASE)


def clean(text: str) -> str:
    """Plain typography: ordinary hyphens, straight quotes and spaces, and a spaced hyphen instead of a long dash (a range such as 20-25 keeps a bare hyphen)."""
    text = text.translate(HYPHENS).translate(QUOTES).translate(SPACES)
    return DASH.sub(" - ", DASH_BETWEEN_DIGITS.sub("-", text))


def strip_numbering(heading: str) -> str:
    """A heading without the "1." or "Step 2:" the model puts in front; the app numbers things itself."""
    return NUMBERING.sub("", heading).strip()


def _clean_value(value):
    return clean(value) if isinstance(value, str) else value


def _clean_heading(value):
    return strip_numbering(clean(value)) if isinstance(value, str) else value


Clean = Annotated[str, BeforeValidator(_clean_value)]
Heading = Annotated[str, BeforeValidator(_clean_heading)]
