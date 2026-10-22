import json
import os
import random
from pathlib import Path

import pytest

from conftest import make_pdf
from samples import module_json, outline_json, rich_lesson_json, rich_questions

FIXTURES = Path(__file__).parent / "fixtures"
UPDATE = os.getenv("UPDATE_FIXTURES") == "1"


def check(name: str, data: dict) -> None:
    """Compares the backend's output with the saved sample the frontend check reads; UPDATE_FIXTURES=1 rewrites it."""
    path = FIXTURES / f"{name}.json"
    data = json.loads(json.dumps(data))
    if "id" in data:
        data["id"] = "course-fixture"
    if "meta" in data:
        data["meta"]["createdAt"] = 0
        if data["meta"].get("documentsKey"):
            data["meta"]["documentsKey"] = "0" * 32
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if UPDATE:
        FIXTURES.mkdir(exist_ok=True)
        path.write_text(text)
    assert path.read_text() == text, f"{name}.json is out of date; run UPDATE_FIXTURES=1 pytest backend/tests/test_contract.py"


@pytest.fixture(autouse=True)
def fixed_draws():
    """Questions are drawn and shuffled at random; the samples need the same draw every time."""
    random.seed(2026)


def scripted_topic_replies() -> list:
    return [rich_lesson_json(), {"questions": rich_questions("quiz")}, {"questions": rich_questions("practice")}]


def test_lazy_course_matches_the_frontend_sample(client, fake_model):
    fake_model.replies = [outline_json(modules=2, topics=2, scope="narrow")]
    response = client.post("/api/courses/generate", data={"mode": "goal", "level": "beginner", "objective": "Docker networking"})
    check("lazy_course", response.json())


def test_documents_course_matches_the_frontend_sample(client, fake_model):
    fake_model.replies = [module_json(topics=1, title="Bridges")] + scripted_topic_replies()
    pdf = make_pdf(["Bridges connect containers."], bookmarks=[("Whole guide", 1)])
    response = client.post("/api/courses/generate", data={"mode": "documents", "level": "beginner"}, files=[("files", ("guide.pdf", pdf, "application/pdf"))])
    check("documents_course", response.json())


TOPIC = {"level": "beginner", "objective": "Docker networking", "course": "Docker", "module": "Basics", "topic": "Bridges", "summary": "About bridges"}


def test_topic_matches_the_frontend_sample(client, fake_model):
    response = client.post("/api/courses/topic", json=TOPIC)
    assert response.status_code == 200
    check("topic", response.json())


def test_module_quiz_matches_the_frontend_sample(client, fake_model):
    client.post("/api/courses/topic", json=TOPIC)
    body = {"level": "beginner", "objective": "Docker networking", "module": "Basics", "topics": [{"title": "Bridges"}]}
    response = client.post("/api/courses/module-quiz", json=body)
    assert response.status_code == 200 and response.json()["quiz"]
    check("module_quiz", response.json())


def test_placement_matches_the_frontend_sample(client, fake_model):
    check("placement", client.post("/api/courses/placement", json={"objective": "Docker networking"}).json())


@pytest.mark.parametrize("name", ["lazy_course", "documents_course", "topic", "module_quiz", "placement"])
def test_every_sample_exists(name):
    assert (FIXTURES / f"{name}.json").exists()
