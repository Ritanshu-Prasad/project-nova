import asyncio

import pytest
from pydantic import ValidationError

import placement
from placement import PlacementAnswer, PlacementQuiz, PlacementRequest, PlacementResult, recommend_level, write_placement
from samples import mcq


def run(coro):
    return asyncio.run(coro)


def question(n: int, difficulty: int) -> dict:
    return {**mcq(n), "difficulty": difficulty}


def answers(*pairs) -> list:
    return [PlacementAnswer(difficulty=difficulty, correct=correct) for difficulty, correct in pairs]


# --- The quiz the model writes ---

def test_the_models_questions_are_kept_in_the_order_it_wrote_them():
    quiz = PlacementQuiz.model_validate({"questions": [question(n, 1) for n in range(5)]})
    assert [q.q for q in quiz.questions] == [f"Question number {n}?" for n in range(5)]


def test_four_valid_questions_are_enough_but_three_are_not():
    four = [question(n, 1) for n in range(4)]
    assert len(PlacementQuiz.model_validate({"questions": four}).questions) == 4
    with pytest.raises(ValidationError):
        PlacementQuiz.model_validate({"questions": four[:3]})


def test_invalid_and_non_multiple_choice_questions_are_dropped():
    quiz = PlacementQuiz.model_validate({"questions": [question(n, 1) for n in range(4)] + [{"type": "truefalse", "q": "True?", "answer": True, "why": ""}, {"type": "mcq", "q": "bad"}]})
    assert len(quiz.questions) == 4 and all(q.type == "mcq" for q in quiz.questions)


def test_difficulty_follows_the_position_whatever_the_model_claimed(fake_model):
    fake_model.replies = [{"questions": [question(n, 1) for n in range(5)]}]
    assert [q.difficulty for q in run(write_placement("Docker"))] == [1, 1, 2, 2, 3]


def test_no_more_than_five_questions_are_used(fake_model):
    fake_model.replies = [{"questions": [question(n, 1) for n in range(8)]}]
    assert len(run(write_placement("Docker"))) == 5


def test_four_questions_get_four_difficulties(fake_model):
    fake_model.replies = [{"questions": [question(n, 3) for n in range(4)]}]
    assert [q.difficulty for q in run(write_placement("Docker"))] == [1, 2, 2, 3]


def test_a_question_whose_key_the_model_cannot_reproduce_is_dropped(fake_model, monkeypatch):
    monkeypatch.delenv("NOVA_VERIFY_ANSWERS")
    fake_model.replies = [{"questions": [question(n, 1) for n in range(5)]}] + [{"answers": [{"number": 1, "choice": [1]}, {"number": 2, "choice": [0]}] + [{"number": n, "choice": [1]} for n in range(3, 6)]}] * 2
    kept = run(write_placement("Docker"))
    assert len(kept) == 4 and "Question number 1?" not in [q.q for q in kept]


def test_the_questions_are_not_dropped_below_four(fake_model, monkeypatch):
    monkeypatch.delenv("NOVA_VERIFY_ANSWERS")
    fake_model.replies = [{"questions": [question(n, 1) for n in range(5)]}] + [{"answers": [{"number": n, "choice": [0]} for n in range(1, 6)]}] * 2
    assert len(run(write_placement("Docker"))) == 5


def test_writing_a_placement_quiz_asks_the_model_for_the_quiz_and_the_check(fake_model, monkeypatch):
    monkeypatch.delenv("NOVA_VERIFY_ANSWERS")
    run(write_placement("Docker networking"))
    assert fake_model.kinds == ["placement", "answers", "answers"] and "<learning_goal>Docker networking</learning_goal>" in fake_model.prompts[0][1]


def test_the_prompt_asks_for_questions_in_order_without_naming_levels():
    import prompts

    system = prompts.placement_system()
    assert "exactly 5" in system and "easiest to hardest" in system and "Do not mention levels" in system


# --- The request ---

def test_the_goal_is_sanitised():
    assert PlacementRequest(objective="Docker\x00 ```x```").objective == "Docker x"


def test_an_oversized_goal_is_rejected():
    with pytest.raises(ValidationError):
        PlacementRequest(objective="x" * 600)


# --- Recommending a level ---

def test_getting_everything_right_means_advanced():
    assert recommend_level(answers((1, True), (1, True), (2, True), (2, True), (3, True))) == "advanced"


def test_getting_everything_wrong_means_beginner():
    assert recommend_level(answers((1, False), (1, False), (2, False), (2, False), (3, False))) == "beginner"


def test_the_easy_questions_alone_mean_intermediate():
    assert recommend_level(answers((1, True), (1, True), (2, True), (2, False), (3, False))) == "intermediate"


def test_harder_questions_count_for_more():
    assert recommend_level(answers((1, False), (1, False), (2, True), (2, False), (3, True))) == "intermediate"
    assert recommend_level(answers((1, False), (1, False), (2, True), (2, True), (3, True))) == "advanced"
    assert recommend_level(answers((1, True), (1, True), (2, False), (2, False), (3, False))) == "beginner"


def share_of(earned: int, total: int) -> list:
    """`total` easy questions of which `earned` were right."""
    return [PlacementAnswer(difficulty=1, correct=True)] * earned + [PlacementAnswer(difficulty=1, correct=False)] * (total - earned)


@pytest.mark.parametrize("earned, total, level", [(39, 100, "beginner"), (2, 5, "intermediate"), (74, 100, "intermediate"), (3, 4, "advanced")])
def test_the_cut_offs_include_their_lower_edge(earned, total, level):
    assert recommend_level(share_of(earned, total)) == level


def test_no_answers_means_beginner():
    assert recommend_level([]) == "beginner"


def test_the_cut_offs_are_ordered():
    assert 0 < placement.INTERMEDIATE_FROM < placement.ADVANCED_FROM < 1


# --- The result body ---

def test_a_result_needs_valid_difficulties_and_at_least_one_answer():
    with pytest.raises(ValidationError):
        PlacementResult(answers=[])
    with pytest.raises(ValidationError):
        PlacementResult(answers=[{"difficulty": 4, "correct": True}])
    with pytest.raises(ValidationError):
        PlacementResult(answers=[{"difficulty": 1, "correct": True}] * 11)


# --- Routes ---

def test_the_placement_route_returns_five_questions_easiest_first(client, fake_model):
    response = client.post("/api/courses/placement", json={"objective": "Docker networking"})
    assert response.status_code == 200
    assert [q["difficulty"] for q in response.json()["questions"]] == [1, 1, 2, 2, 3]


def test_a_placement_quiz_is_reused_for_the_same_goal(client, fake_model):
    client.post("/api/courses/placement", json={"objective": "Docker networking"})
    calls = len(fake_model.calls)
    client.post("/api/courses/placement", json={"objective": "DOCKER  networking"})
    assert len(fake_model.calls) == calls


def test_the_placement_route_rejects_a_short_goal(client, fake_model):
    assert client.post("/api/courses/placement", json={"objective": "x"}).status_code == 422
    assert fake_model.calls == []


def test_a_harmful_goal_gets_no_placement_quiz(client, fake_model, monkeypatch):
    monkeypatch.delenv("NOVA_MODERATION")
    fake_model.replies = [{"allowed": False, "reason": "No."}]
    response = client.post("/api/courses/placement", json={"objective": "something harmful"})
    assert response.status_code == 422 and response.json()["detail"] == "No."


def test_the_level_route_recommends_a_level(client, fake_model):
    body = {"answers": [{"difficulty": 1, "correct": True}, {"difficulty": 2, "correct": True}, {"difficulty": 3, "correct": True}]}
    assert client.post("/api/courses/placement/level", json=body).json() == {"level": "advanced"}


def test_the_level_route_needs_answers(client, fake_model):
    assert client.post("/api/courses/placement/level", json={"answers": []}).status_code == 422
