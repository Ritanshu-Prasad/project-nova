import course_models as course
from module_content import ModuleContent

WORDS_PER_MINUTE = 200
MIN_MINUTES = 3
MAX_OBJECTIVES = 4
DIFFICULTY = {"mcq": 1, "true_false": 1, "msq": 2, "order": 2}


# --- Lesson ---

def to_lesson(content: ModuleContent) -> course.Lesson:
    """A written module as the lesson the app shows: each section a text block with its analogy, steps and code, the key terms after the first section."""
    blocks: list[dict] = []
    for number, section in enumerate(content.sections):
        blocks.append({"type": "text", "title": section.heading, "body": section.explanation})
        if section.analogy:
            blocks.append({"type": "analogy", "body": section.analogy})
        if section.action_steps:
            blocks.append({"type": "steps", "title": "Try it", "steps": section.action_steps})
        blocks += [{"type": "source", "doc": source.doc, "page": source.page, "excerpt": source.excerpt} for source in section.sources or []]
        if section.code:
            blocks.append({"type": "code", "language": section.code.language, "code": section.code.snippet, "caption": section.code.explanation})
        if number == 0:
            blocks.append({"type": "keyTerms", "terms": [{"term": term.term, "def": term.definition} for term in content.key_terms]})
    blocks.append({"type": "summary", "points": [section.heading for section in content.sections]})
    words = len(content.as_text().split())
    return course.Lesson.model_validate({
        "minutes": max(MIN_MINUTES, round(words / WORDS_PER_MINUTE)),
        "objectives": [f"Understand {section.heading.lower()}" for section in content.sections][:MAX_OBJECTIVES],
        "simple": content.overview,
        "blocks": blocks,
    })


# --- Questions ---

def to_question(question) -> course.Question:
    """A bank question in the shape the app and the answer check use. Ordering items stay in the correct order; the app scrambles them."""
    base = {"q": question.question_text, "why": question.explanation, "difficulty": DIFFICULTY[question.type]}
    if question.type == "true_false":
        return course.TrueFalse(type="truefalse", answer=question.correct_answer, **base)
    if question.type == "order":
        return course.Order(type="order", items=question.items, **base)
    options = [option.text for option in question.options]
    ids = [option.id for option in question.options]
    if question.type == "msq":
        return course.Multi(type="multi", options=options, answers=sorted(ids.index(answer) for answer in question.correct_answer), **base)
    return course.Mcq(type="mcq", options=options, answer=ids.index(question.correct_answer), **base)
