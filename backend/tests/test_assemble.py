from pydantic import TypeAdapter

import prompts

from assemble import assemble_course, assemble_lazy_course, dedupe_questions, verify_sources, _verified_lesson
from course_models import Lesson, Question
from course_requests import CourseRequest
from pdf_parser import Document, Page
from planning import Outline
from samples import lesson_json, mcq, outline_json, questions
from writing import TopicContent

question = TypeAdapter(Question).validate_python


def parsed(items: list) -> list:
    return [question(item) for item in items]


def request() -> CourseRequest:
    return CourseRequest(mode="goal", level="intermediate", objective="Docker")


def content(quiz: list, practice: list) -> TopicContent:
    return TopicContent(Lesson.model_validate(lesson_json()), parsed(quiz), parsed(practice))


# --- Duplicate questions ---

def test_dedupe_removes_repeats_ignoring_case_and_punctuation():
    first, repeat = parsed([{**mcq(), "q": "What is a bridge?"}, {**mcq(), "q": "what is a BRIDGE"}])
    assert dedupe_questions([first, repeat], set()) == [first]


def test_dedupe_shares_the_seen_set_across_lists():
    one = question(mcq(1))
    seen: set = set()
    dedupe_questions([one], seen)
    assert dedupe_questions([one], seen) == []


# --- Courses ---

def outline(modules=2, topics=2) -> Outline:
    return Outline.model_validate(outline_json(modules, topics))


def documents() -> list:
    return [Document("book.pdf", [Page("book.pdf", n, "text") for n in range(1, 4)])]


def test_a_course_has_stable_numbered_ids():
    contents = [[content(questions(8), questions(12, start=100)) for _ in range(2)] for _ in range(2)]
    course = assemble_course(outline(), contents, request(), documents())
    assert [m.id for m in course.modules] == ["mod-1", "mod-2"]
    assert [t.id for t in course.modules[1].topics] == ["top-2-1", "top-2-2"]


def test_a_course_lists_its_documents_and_source():
    contents = [[content(questions(8), questions(12, start=100)) for _ in range(2)] for _ in range(2)]
    course = assemble_course(outline(), contents, request(), documents())
    assert course.source == "documents" and [(d.name, d.pages) for d in course.documents] == [("book.pdf", 3)]


def test_a_topic_never_repeats_a_question_between_quiz_and_practice():
    course = assemble_course(outline(1, 1), [[content(questions(8), questions(12))]], request(), documents())
    topic = course.modules[0].topics[0]
    assert len(topic.quiz) == 8 and len(topic.practice) == 4


def test_the_objective_falls_back_to_the_focus_then_the_title():
    contents = [[content(questions(8), questions(12, start=100))]]
    focused = CourseRequest(mode="documents", level="beginner", focus="Chapter 3")
    assert assemble_course(outline(1, 1), contents, focused, documents()).objective == "Chapter 3"
    assert assemble_course(outline(1, 1), contents, CourseRequest(mode="documents", level="beginner"), documents()).objective == "Sample Course"


def test_a_lazy_course_has_placeholder_topics_and_module_quizzes():
    course = assemble_lazy_course(outline(), [parsed(questions(10)), parsed(questions(10, start=50))], request())
    assert course.source == "ai" and course.documents is None
    assert [len(m.quiz) for m in course.modules] == [10, 10]
    assert all(t.loaded is False and t.lesson.blocks == [] for m in course.modules for t in m.topics)


def test_lazy_topics_keep_the_planned_minutes():
    course = assemble_lazy_course(outline(1, 1), [[]], request())
    assert course.modules[0].topics[0].lesson.minutes == 5


# --- Citations ---

QUOTE = "Chlorophyll absorbs red and blue light in the thylakoid membrane"


def book(*texts: str, name: str = "a.pdf") -> Document:
    return Document(name, [Page(name, number, text) for number, text in enumerate(texts, start=1)])


def lesson_with(*sources) -> Lesson:
    blocks = [{"type": "text", "body": "Body"}, *({"type": "source", "excerpt": QUOTE, **source} for source in sources)]
    return Lesson.model_validate({"blocks": blocks})


def cited(lesson) -> list:
    return [(b.doc, b.page) for b in lesson.blocks if b.type == "source"]


def check(lesson, *documents) -> Lesson:
    return _verified_lesson(lesson, {document.name: document for document in documents})


A_BOOK = book("Intro to biology.", f"Notes: {QUOTE}, then more.", "Other things.")


def test_a_citation_that_is_on_the_cited_page_is_kept():
    assert cited(check(lesson_with({"doc": "a.pdf", "page": 2}), A_BOOK)) == [("a.pdf", 2)]


def test_a_wrong_page_is_repaired_to_the_page_that_holds_the_quote():
    assert cited(check(lesson_with({"doc": "a.pdf", "page": 1}), A_BOOK)) == [("a.pdf", 2)]


def test_a_missing_page_is_repaired_too():
    assert cited(check(lesson_with({"doc": "a.pdf", "page": None}), A_BOOK)) == [("a.pdf", 2)]
    assert cited(check(lesson_with({"doc": "a.pdf", "page": 99}), A_BOOK)) == [("a.pdf", 2)]


def test_a_quote_that_is_not_in_the_document_is_dropped():
    lesson = check(lesson_with({"doc": "a.pdf", "page": 2}), book("Nothing about plants here.", "Or here either."))
    assert cited(lesson) == [] and [b.type for b in lesson.blocks] == ["text"]


def test_a_small_difference_in_wording_still_matches():
    lesson = lesson_with({"doc": "a.pdf", "page": 2})
    assert cited(check(lesson, book("x", "chlorophyll absorbs RED and blue light in the thylakoid membrane!!"))) == [("a.pdf", 2)]


def test_an_unknown_document_is_corrected_when_there_is_only_one():
    assert cited(check(lesson_with({"doc": "made-up.pdf", "page": 2}), A_BOOK)) == [("a.pdf", 2)]


def test_an_unknown_document_is_dropped_when_there_are_several():
    lesson = check(lesson_with({"doc": "made-up.pdf", "page": 2}), A_BOOK, book("other", name="b.pdf"))
    assert cited(lesson) == []


def test_the_quote_is_found_in_the_right_one_of_several_documents():
    other = book("Different text entirely.", name="b.pdf")
    assert cited(check(lesson_with({"doc": "b.pdf", "page": 1}), A_BOOK, other)) == []
    assert cited(check(lesson_with({"doc": "a.pdf", "page": 2}), A_BOOK, other)) == [("a.pdf", 2)]


def test_a_very_short_quote_must_appear_word_for_word():
    short = Lesson.model_validate({"blocks": [{"type": "source", "doc": "a.pdf", "page": 1, "excerpt": "Mitosis"}]})
    assert cited(check(short, book("Cells divide by Mitosis."))) == [("a.pdf", 1)]
    assert cited(check(short, book("Cells divide."))) == []


def test_other_blocks_are_left_alone():
    assert [b.type for b in check(lesson_with(), A_BOOK).blocks] == ["text"]


def test_verify_sources_checks_every_topic_against_the_uploaded_documents():
    topic = TopicContent(lesson_with({"doc": "x.pdf", "page": 1}), [], [])
    [[checked]] = verify_sources([[topic]], [A_BOOK])
    assert cited(checked.lesson) == [("a.pdf", 2)]


# --- How a course was written ---

def test_a_course_records_its_model_and_prompt_version(monkeypatch):
    monkeypatch.setenv("NOVA_ALLOWED_MODELS", "some/model")
    monkeypatch.setenv("NOVA_GENERATE_MODEL", "some/model")
    course = assemble_lazy_course(outline(1, 1), [[]], request())
    assert course.meta.model == "some/model" and course.meta.promptVersion == prompts.PROMPT_VERSION and course.meta.createdAt > 0


def test_a_document_course_records_it_too():
    contents = [[content(questions(8), questions(12, start=100))]]
    assert assemble_course(outline(1, 1), contents, request(), documents()).meta.promptVersion == prompts.PROMPT_VERSION
