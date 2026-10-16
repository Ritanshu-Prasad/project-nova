def mcq(n: int = 0) -> dict:
    return {"type": "mcq", "q": f"Question number {n}?", "options": ["a", "b", "c", "d"], "answer": 1, "why": "Because."}


def questions(count: int, start: int = 0) -> list:
    return [mcq(start + i) for i in range(count)]


def lesson_json() -> dict:
    return {
        "minutes": 6,
        "objectives": ["Explain the idea"],
        "simple": "A short version.",
        "blocks": [
            {"type": "text", "title": "Intro", "body": "Some body text."},
            {"type": "keyTerms", "terms": [{"term": "Term", "def": "Definition"}]},
            {"type": "summary", "points": ["One point"]},
        ],
    }


def outline_json(modules: int = 2, topics: int = 2, scope: str = "broad") -> dict:
    return {
        "title": "Sample Course",
        "subtitle": "A sample",
        "scope": scope,
        "modules": [
            {
                "title": f"Module {m}",
                "topics": [
                    {"title": f"Topic {m}.{t}", "planet": f"Planet {m}{t}", "kind": "concept", "summary": "About it.", "minutes": 5}
                    for t in range(1, topics + 1)
                ],
            }
            for m in range(1, modules + 1)
        ],
    }
