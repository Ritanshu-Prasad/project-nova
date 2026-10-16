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


def module_json(topics: int = 2, title: str = "Sample Module") -> dict:
    return {
        "title": title,
        "topics": [
            {"title": f"{title} topic {t}", "planet": f"Star {t}", "kind": "concept", "summary": "About it.", "minutes": 5}
            for t in range(1, topics + 1)
        ],
    }


def rich_lesson_json() -> dict:
    """One block of every type the frontend knows."""
    return {
        "minutes": 7,
        "objectives": ["Explain bridges", "Compare network types"],
        "simple": "Bridges connect containers.",
        "blocks": [
            {"type": "text", "title": "Overview", "body": "A **bridge** links containers."},
            {"type": "analogy", "body": "Like a switch in an office."},
            {"type": "keyTerms", "terms": [{"term": "Bridge", "def": "A virtual switch"}, {"term": "Veth", "def": "A virtual cable"}]},
            {"type": "steps", "title": "Create one", "steps": ["Run docker network create", "Attach a container"]},
            {"type": "code", "language": "bash", "code": "docker network create demo", "caption": "Create a network"},
            {"type": "formula", "expr": "capacity = ports x speed", "caption": "Rough capacity"},
            {"type": "compare", "title": "Bridge vs host", "columns": ["Bridge", "Host"], "rows": [["Isolation", "Yes", "No"]]},
            {"type": "example", "title": "Two containers", "body": "web and db share a bridge."},
            {"type": "callout", "tone": "warning", "body": "The default bridge has no DNS."},
            {"type": "source", "doc": "guide.pdf", "page": 1, "excerpt": "Bridges connect containers."},
            {"type": "summary", "points": ["Bridges isolate", "Names resolve on user bridges"]},
        ],
    }


def rich_questions(tag: str) -> list:
    """One question of every type the frontend knows; `tag` keeps the wording unique per list."""
    return [
        {"type": "mcq", "q": f"{tag}: which network is the default?", "options": ["bridge", "host", "none", "overlay"], "answer": 0, "why": "Bridge is the default.", "difficulty": 1},
        {"type": "multi", "q": f"{tag}: which are drivers?", "options": ["bridge", "host", "tractor", "overlay"], "answers": [0, 1, 3], "why": "Three are real drivers.", "difficulty": 2},
        {"type": "truefalse", "q": f"{tag}: bridges isolate containers.", "answer": True, "why": "They form a private network.", "difficulty": 1},
        {"type": "fill", "q": f"{tag}: the default driver is ____.", "answer": "bridge", "accept": ["Bridge"], "why": "It is the default.", "difficulty": 1},
        {"type": "code", "q": f"{tag}: create a network named demo.", "language": "bash", "starter": "docker ", "solution": "docker network create demo", "checks": [{"label": "uses network create", "pattern": "network\\s+create"}], "why": "That is the command.", "difficulty": 2},
        {"type": "order", "q": f"{tag}: order the steps.", "items": ["Create network", "Start container", "Attach container"], "why": "Create first.", "difficulty": 2},
        {"type": "match", "q": f"{tag}: match driver to use.", "pairs": [["bridge", "single host"], ["overlay", "multi host"]], "why": "Scope differs.", "difficulty": 3},
    ]
