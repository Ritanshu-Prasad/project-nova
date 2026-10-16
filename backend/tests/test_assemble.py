from pydantic import TypeAdapter

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

def lesson_with(*sources) -> Lesson:
    blocks = [{"type": "text", "body": "Body"}, *({"type": "source", "excerpt": "quote", **source} for source in sources)]
    return Lesson.model_validate({"blocks": blocks})


def cited(lesson) -> list:
    return [(b.doc, b.page) for b in lesson.blocks if b.type == "source"]


def test_a_valid_citation_is_kept():
    assert cited(_verified_lesson(lesson_with({"doc": "a.pdf", "page": 2}), {"a.pdf": 5, "b.pdf": 3})) == [("a.pdf", 2)]


def test_a_page_that_does_not_exist_is_removed_from_the_citation():
    assert cited(_verified_lesson(lesson_with({"doc": "a.pdf", "page": 99}), {"a.pdf": 5})) == [("a.pdf", None)]


def test_an_unknown_document_is_corrected_when_there_is_only_one():
    assert cited(_verified_lesson(lesson_with({"doc": "made-up.pdf", "page": 1}), {"a.pdf": 5})) == [("a.pdf", 1)]


def test_an_unknown_document_is_dropped_when_there_are_several():
    lesson = _verified_lesson(lesson_with({"doc": "made-up.pdf", "page": 1}), {"a.pdf": 5, "b.pdf": 3})
    assert cited(lesson) == [] and [b.type for b in lesson.blocks] == ["text"]


def test_verify_sources_checks_every_topic_against_the_uploaded_documents():
    topic = TopicContent(lesson_with({"doc": "x.pdf", "page": 1}), [], [])
    [[checked]] = verify_sources([[topic]], documents())
    assert cited(checked.lesson) == [("book.pdf", 1)]
