import pytest
from course_models import Course


def test_interview_endpoint_returns_targeted_question(client, fake_model):
    response = client.post(
        "/api/courses/forge/interview",
        json={"objective": "Learn Rust", "level": "intermediate", "history": []},
    )
    assert response.status_code == 200
    data = response.json()
    assert "question" in data
    assert data["turn"] == 1
    assert data["maxTurns"] == 3
    assert isinstance(data["suggestions"], list)
    assert len(data["suggestions"]) > 0


def test_interview_endpoint_validates_short_objective(client, fake_model):
    response = client.post(
        "/api/courses/forge/interview",
        json={"objective": "a", "level": "beginner", "history": []},
    )
    assert response.status_code == 422


def test_blueprint_endpoint_generates_outline(client, fake_model):
    response = client.post(
        "/api/courses/forge/blueprint",
        json={
            "objective": "Learn Rust for Systems Programming",
            "level": "intermediate",
            "interviewSummary": "Experienced in C++, wants async raft consensus",
        },
    )
    assert response.status_code == 200
    outline = response.json()
    assert "title" in outline
    assert "modules" in outline
    assert len(outline["modules"]) >= 1
    for m in outline["modules"]:
        assert len(m["topics"]) >= 1


def test_finalize_custom_blueprint_produces_valid_course(client, fake_model):
    payload = {
        "objective": "Rust Systems",
        "level": "intermediate",
        "title": "Mastering Rust Internals",
        "subtitle": "From ownership to async runtimes",
        "modules": [
            {
                "title": "Memory Models & Ownership",
                "topics": [
                    {"title": "Stack vs Heap", "planet": "Vega", "kind": "programming", "summary": "Memory management", "minutes": 7},
                    {"title": "Borrow Checker", "planet": "Lyra", "kind": "programming", "summary": "Lifetimes and borrows", "minutes": 8},
                ],
            },
            {
                "title": "Async & Concurrency",
                "topics": [
                    {"title": "Futures & Polling", "planet": "Altair", "kind": "programming", "summary": "State machines", "minutes": 10},
                ],
            },
        ],
    }
    response = client.post("/api/courses/forge/finalize", json=payload)
    assert response.status_code == 200
    course_data = response.json()

    # Validate against strict Course schema
    course = Course.model_validate(course_data)
    assert course.title == "Mastering Rust Internals"
    assert course.level == "intermediate"
    assert len(course.modules) == 2
    assert [m.title for m in course.modules] == ["Memory Models & Ownership", "Async & Concurrency"]
    assert course.modules[0].topics[0].planet == "Vega"
    assert course.modules[0].topics[0].loaded is False
    # Module quizzes must be generated and attached
    assert course.modules[0].quiz is not None
    assert len(course.modules[0].quiz) > 0
