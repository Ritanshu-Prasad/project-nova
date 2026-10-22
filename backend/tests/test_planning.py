import pytest
from fastapi import HTTPException

import planning
from course_requests import CourseRequest
from pdf_parser import Document, Page, Section
from planning import Outline, OutlineTopic, fit_outline, plan_document_outline, plan_outline
from samples import module_json, outline_json


def request(**fields) -> CourseRequest:
    return CourseRequest(mode="goal", objective="Docker", **fields)


def fitted(modules: int, topics: int, scope: str) -> Outline:
    return fit_outline(Outline.model_validate(outline_json(modules, topics, scope)))


def group_of(title: str, text: str = "words") -> list:
    return [Section("a.pdf", title, [Page("a.pdf", 1, text)])]


# --- Outline types ---

def test_unknown_topic_kind_becomes_concept():
    assert OutlineTopic(title="T", planet="P", kind="nonsense").kind == "concept"


def test_unknown_scope_is_treated_as_broad():
    assert Outline.model_validate(outline_json(scope="huge")).scope == "broad"


def test_an_outline_needs_at_least_one_module():
    with pytest.raises(ValueError):
        Outline.model_validate({"title": "Empty", "modules": []})


# --- Size ---

def test_narrow_outline_is_cut_to_three_modules_of_three_topics():
    outline = fitted(modules=5, topics=4, scope="narrow")
    assert len(outline.modules) == 3 and all(len(module.topics) == 3 for module in outline.modules)


def test_broad_outline_is_cut_to_six_modules_of_four_topics():
    outline = fitted(modules=8, topics=6, scope="broad")
    assert len(outline.modules) == 6 and all(len(module.topics) == 4 for module in outline.modules)


def test_outline_within_the_limits_is_left_alone():
    assert [len(m.topics) for m in fitted(modules=2, topics=2, scope="narrow").modules] == [2, 2]


# --- From a goal ---

def test_plan_outline_asks_the_model_once_for_the_whole_course(fake_model):
    import asyncio

    outline = asyncio.run(plan_outline(request()))
    assert outline.title == "Sample Course" and len(fake_model.calls) == 1


def test_plan_outline_gives_up_with_502_on_unusable_answers(fake_model):
    import asyncio

    fake_model.replies = [{"nonsense": True}] * 3
    with pytest.raises(HTTPException) as error:
        asyncio.run(plan_outline(request()))
    assert error.value.status_code == 502


# --- From documents ---

def plan(documents, groups):
    import asyncio

    doc_request = CourseRequest(mode="documents")
    return asyncio.run(plan_document_outline(doc_request, documents, groups, []))


def test_one_module_is_planned_per_group(fake_model):
    outline = plan([Document("a.pdf", [])], [group_of("One"), group_of("Two"), group_of("Three")])
    assert len(outline.modules) == 3 and len(fake_model.calls) == 3


def test_document_modules_keep_at_most_three_topics(fake_model):
    fake_model.replies = [module_json(topics=6)]
    assert len(plan([Document("a.pdf", [])], [group_of("One")]).modules[0].topics) == planning.DOCUMENT_TOPICS_PER_MODULE


@pytest.mark.parametrize("names, title, subtitle", [
    (["intro_to-biology.pdf"], "Intro To Biology", "Built from 1 document"),
    (["a.pdf", "b.pdf"], "A & B", "Built from 2 documents"),
])
def test_the_course_is_named_after_its_documents(fake_model, names, title, subtitle):
    outline = plan([Document(name, []) for name in names], [group_of("One")])
    assert (outline.title, outline.subtitle) == (title, subtitle)


def test_outline_titles_are_made_plain_and_lose_their_numbering():
    from planning import Outline

    outline = Outline.model_validate({"title": "1. Short‑term money", "modules": [{"title": "Step 2: Budget “basics”", "topics": [{"title": "3) Track—review", "planet": "Vega", "summary": "A ‑ b"}]}]})
    assert outline.title == "Short-term money"
    assert outline.modules[0].title == 'Budget "basics"' and outline.modules[0].topics[0].title == "Track - review"


# --- Planet names ---

def outline_with_planets(*planets):
    from planning import Outline

    return Outline.model_validate({"title": "T", "modules": [{"title": "M", "topics": [{"title": f"Topic {n}", "planet": planet} for n, planet in enumerate(planets)]}]})


def planets_of(outline):
    return [topic.planet for module in outline.modules for topic in module.topics]


def test_the_products_own_name_is_never_a_planet():
    from planning import named_planets

    names = planets_of(named_planets(outline_with_planets("Vega", "Nova", "nova")))
    assert "nova" not in [name.casefold() for name in names] and len(set(names)) == 3


def test_a_repeated_planet_gets_a_new_name_and_the_first_keeps_its_own():
    from planning import named_planets

    names = planets_of(named_planets(outline_with_planets("Vega", "Lyra", "Vega")))
    assert names[:2] == ["Vega", "Lyra"] and len({name.casefold() for name in names}) == 3


def test_a_blank_planet_gets_a_name_and_good_names_are_untouched():
    from planning import named_planets

    assert planets_of(named_planets(outline_with_planets("Orion", "Atlas"))) == ["Orion", "Atlas"]
    assert planets_of(named_planets(outline_with_planets("", "Atlas")))[0] != ""


def test_replacement_names_do_not_clash_with_names_the_model_already_used():
    from planning import named_planets

    names = planets_of(named_planets(outline_with_planets("Nova", "Sirius", "Rigel", "Rigel")))
    assert len({name.casefold() for name in names}) == 4 and "Sirius" in names and names.count("Rigel") == 1


def test_fitting_an_outline_also_names_its_planets():
    from planning import fit_outline

    assert "nova" not in [name.casefold() for name in planets_of(fit_outline(outline_with_planets("Nova", "Vega")))]
