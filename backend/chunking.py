import re
from math import ceil

from pdf_parser import Page, Section

MAX_GROUPS = 6
GROUP_TARGET_CHARS = 12_000
OVERVIEW_CHARS = 24_000
TOPIC_CONTEXT_CHARS = 16_000
EXCERPT_CHARS = 160
MIN_TERM_LENGTH = 3

Group = list[Section]


# --- Grouping ---

def group_sections(sections: list[Section], structure: str) -> list[Group]:
    """One group per course module: chapters stay as they are, topics are merged into evenly sized groups."""
    target = _target_count(sections, structure)
    if structure == "chapters":
        return _merge_smallest([[section] for section in sections], target)
    return _split_evenly(sections, target)


def _target_count(sections: list[Section], structure: str) -> int:
    if structure == "chapters":
        return min(len(sections), MAX_GROUPS)
    total = sum(len(section.text) for section in sections)
    return min(len(sections), max(2, min(MAX_GROUPS, ceil(total / GROUP_TARGET_CHARS))))


def _merge_smallest(groups: list[Group], target: int) -> list[Group]:
    groups = list(groups)
    while len(groups) > target:
        sizes = [_size(a) + _size(b) for a, b in zip(groups, groups[1:])]
        i = sizes.index(min(sizes))
        groups[i : i + 2] = [groups[i] + groups[i + 1]]
    return groups


def _split_evenly(sections: list[Section], target: int) -> list[Group]:
    total = sum(len(section.text) for section in sections)
    groups: list[Group] = [[] for _ in range(target)]
    before = 0
    for section in sections:
        size = len(section.text)
        groups[min(target - 1, int((before + size / 2) / total * target))].append(section)
        before += size
    return [group for group in groups if group]


def _size(group: Group) -> int:
    return sum(len(section.text) for section in group)


# --- Focus ---

def focus_terms(focus: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", focus.lower())
    return [word for word in dict.fromkeys(words) if len(word) >= MIN_TERM_LENGTH]


def score_text(text: str, terms: list[str]) -> int:
    lowered = text.lower()
    return sum(lowered.count(term) for term in terms)


# --- Context for the model ---

def build_overview(groups: list[Group], terms: list[str], limit: int = OVERVIEW_CHARS) -> str:
    """The table of contents of every group with a short excerpt of each section, for planning the outline."""
    sections = [section for group in groups for section in group]
    excerpt = max(EXCERPT_CHARS, limit // max(1, len(sections)) - EXCERPT_CHARS)
    lines = []
    for number, group in enumerate(groups, start=1):
        lines.append(f"Group {number}:")
        for section in group:
            marker = " [matches the focus]" if score_text(section.text, terms) else ""
            lines.append(f"- {section.title} ({_page_range(section)}){marker}: {_flatten(section.text)[:excerpt]}")
    return "\n".join(lines)[:limit]


def build_topic_context(group: Group, terms: list[str], limit: int = TOPIC_CONTEXT_CHARS) -> str:
    """The pages the topics of one module are written from, favouring pages that match the focus."""
    pages = [page for section in group for page in section.pages if page.text]
    chosen = _choose_pages(pages, terms, limit)
    return "\n\n".join(_tagged(page, full=page.number in chosen) for page in pages)


def _choose_pages(pages: list[Page], terms: list[str], limit: int) -> set[int]:
    ranked = sorted(pages, key=lambda page: -score_text(page.text, terms))
    chosen: set[int] = set()
    used = len(pages) * (EXCERPT_CHARS + 20)
    for page in ranked:
        if used + len(page.text) > limit:
            continue
        chosen.add(page.number)
        used += len(page.text)
    return chosen


def _tagged(page: Page, full: bool) -> str:
    body = page.text if full else _flatten(page.text)[:EXCERPT_CHARS] + "…"
    return f"[{page.doc} p.{page.number}]\n{body}"


def _page_range(section: Section) -> str:
    first, last = section.pages[0].number, section.pages[-1].number
    return f"{section.doc} p.{first}" if first == last else f"{section.doc} pp.{first}-{last}"


def _flatten(text: str) -> str:
    return " ".join(text.split())
