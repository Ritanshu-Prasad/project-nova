import pytest
from pydantic import BaseModel

from text_clean import Clean, Heading, clean, strip_numbering


@pytest.mark.parametrize("raw, expected", [
    ("short‑term goals", "short-term goals"),
    ("check‐ins and‒more", "check-ins and-more"),
    ("“quoted” and ‘single’", "\"quoted\" and 'single'"),
    ("a b c", "a b c"),
    ("rent — about half", "rent - about half"),
    ("rent—about half", "rent - about half"),
    ("pause – then go", "pause - then go"),
    ("20–25 minutes", "20-25 minutes"),
    ("2020 — 2024", "2020-2024"),
])
def test_typography_is_made_plain(raw, expected):
    assert clean(raw) == expected


@pytest.mark.parametrize("text", ["e-mail", "20-25 minutes", "plain text.", "It's fine", 'say "hi"', "a - b", ""])
def test_text_that_is_already_plain_is_left_alone(text):
    assert clean(text) == text


@pytest.mark.parametrize("raw, expected", [
    ("1. Clarify Your Net Income", "Clarify Your Net Income"),
    ("2) Track spending", "Track spending"),
    ("Step 3: Set a goal", "Set a goal"),
    ("4 - Review", "Review"),
    ("  10. Ten things", "Ten things"),
])
def test_numbering_is_taken_off_a_heading(raw, expected):
    assert strip_numbering(raw) == expected


@pytest.mark.parametrize("heading", ["2024 outlook", "Step by step", "3 habits that stick", "Why 5G matters"])
def test_a_heading_that_merely_contains_a_number_keeps_it(heading):
    assert strip_numbering(heading) == heading


class Sample(BaseModel):
    heading: Heading
    body: Clean
    items: list[Clean]


def test_the_field_types_clean_on_the_way_in():
    sample = Sample(heading="1. Short‑term goals", body="“Hi”", items=["a—b"])
    assert (sample.heading, sample.body, sample.items) == ("Short-term goals", '"Hi"', ["a - b"])
