import chunking
from chunking import build_overview, build_topic_context, focus_terms, group_sections, score_text
from pdf_parser import Page, Section


def section(title: str, text: str = "word " * 40, first: int = 1, last: int | None = None, doc: str = "a.pdf") -> Section:
    last = last or first
    return Section(doc, title, [Page(doc, number, text) for number in range(first, last + 1)])


def sections_of(count: int, text: str = "word " * 40) -> list[Section]:
    return [section(f"Chapter {n}", text, first=n) for n in range(1, count + 1)]


def titles(groups) -> list[list[str]]:
    return [[s.title for s in group] for group in groups]


# --- group_sections ---

def test_chapters_keep_one_group_each():
    assert titles(group_sections(sections_of(3), "chapters")) == [["Chapter 1"], ["Chapter 2"], ["Chapter 3"]]


def test_too_many_chapters_are_merged_down_to_the_limit_in_order():
    groups = group_sections(sections_of(9), "chapters")
    assert len(groups) == chunking.MAX_GROUPS
    assert [t for names in titles(groups) for t in names] == [f"Chapter {n}" for n in range(1, 10)]


def test_the_smallest_neighbours_are_merged_first():
    sections = [section("Big 1", "x" * 500, 1), section("Tiny", "x" * 5, 2), section("Tiny 2", "x" * 5, 3), section("Big 2", "x" * 500, 4)]
    assert titles(chunking._merge_smallest([[s] for s in sections], 3)) == [["Big 1"], ["Tiny", "Tiny 2"], ["Big 2"]]


def test_topics_are_grouped_by_size(monkeypatch):
    monkeypatch.setattr(chunking, "GROUP_TARGET_CHARS", 1000)
    groups = group_sections(sections_of(10, "x" * 200), "topics")
    assert len(groups) == 2
    assert [len(g) for g in groups] == [5, 5]


def test_topics_never_make_more_groups_than_sections():
    assert len(group_sections(sections_of(1), "topics")) == 1


def test_topics_make_at_least_two_groups_for_a_long_document():
    assert len(group_sections(sections_of(5, "x" * 50), "topics")) == 2


# --- focus ---

def test_focus_terms_are_lowercase_unique_and_not_tiny():
    assert focus_terms("Thermodynamics of Heat, thermodynamics!") == ["thermodynamics", "heat"]


def test_focus_terms_ignore_two_letter_words():
    assert focus_terms("of AI in it") == []


def test_score_counts_every_match_ignoring_case():
    assert score_text("Heat flows. HEAT again, heating", ["heat"]) == 3


def test_score_is_zero_without_terms():
    assert score_text("anything", []) == 0


# --- build_overview ---

def test_overview_lists_every_group_with_titles_and_pages():
    groups = group_sections([section("Basics", first=1, last=3), section("Advanced", first=4, last=6)], "chapters")
    overview = build_overview(groups, [])
    assert "Group 1:" in overview and "Group 2:" in overview
    assert "- Basics (a.pdf pp.1-3)" in overview and "- Advanced (a.pdf pp.4-6)" in overview


def test_overview_marks_sections_that_match_the_focus():
    groups = group_sections([section("Heat", "thermodynamics everywhere", 1), section("Light", "optics", 2)], "chapters")
    lines = build_overview(groups, ["thermodynamics"]).splitlines()
    assert any("Heat" in line and "[matches the focus]" in line for line in lines)
    assert not any("Light" in line and "[matches the focus]" in line for line in lines)


def test_overview_stays_within_the_limit():
    groups = group_sections(sections_of(6, "long text " * 2000), "chapters")
    assert len(build_overview(groups, [], limit=2500)) <= 3000


def test_overview_names_a_single_page_without_a_range():
    assert "(a.pdf p.4)" in build_overview([[section("One page", first=4)]], [])


# --- build_topic_context ---

def test_small_groups_are_sent_whole_with_page_tags():
    context = build_topic_context([section("A", "alpha text", first=1, last=2)], [])
    assert context == "[a.pdf p.1]\nalpha text\n\n[a.pdf p.2]\nalpha text"


def test_pages_matching_the_focus_are_kept_in_full_when_space_is_short():
    pages = [Page("a.pdf", n, ("quantum " if n == 5 else "filler ") * 100) for n in range(1, 9)]
    context = build_topic_context([Section("a.pdf", "All", pages)], ["quantum"], limit=2500)
    assert ("quantum " * 100).strip() in context
    assert ("filler " * 100).strip() not in context


def test_background_pages_are_reduced_to_short_excerpts_not_dropped():
    pages = [Page("a.pdf", n, f"page{n} " + "filler " * 200) for n in range(1, 7)]
    context = build_topic_context([Section("a.pdf", "All", pages)], [], limit=2500)
    assert all(f"[a.pdf p.{n}]" in context for n in range(1, 7))
    assert "…" in context


def test_context_without_a_focus_prefers_the_earliest_pages():
    pages = [Page("a.pdf", n, f"marker{n} " + "filler " * 200) for n in range(1, 7)]
    context = build_topic_context([Section("a.pdf", "All", pages)], [], limit=2500)
    assert ("marker1 " + "filler " * 200).strip() in context


def test_context_stays_close_to_the_limit():
    pages = [Page("a.pdf", n, "filler " * 500) for n in range(1, 21)]
    assert len(build_topic_context([Section("a.pdf", "All", pages)], [], limit=6000)) <= 6000 + 20 * 40


def test_empty_pages_are_skipped():
    context = build_topic_context([Section("a.pdf", "All", [Page("a.pdf", 1, ""), Page("a.pdf", 2, "text")])], [])
    assert context == "[a.pdf p.2]\ntext"
