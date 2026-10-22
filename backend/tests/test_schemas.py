import json
from pathlib import Path

from module_content import ModuleContent
from question_bank import Mcq, Msq, Order, TrueFalse

SCHEMAS = Path(__file__).parent.parent / "schemas"


def load(name: str) -> dict:
    return json.loads((SCHEMAS / name).read_text("utf-8"))


def required(model) -> set[str]:
    return {name for name, field in model.model_fields.items() if field.is_required()}


def test_the_module_schema_requires_what_the_model_requires():
    schema = load("module_content.schema.json")
    assert set(schema["required"]) == required(ModuleContent)
    assert set(schema["properties"]) == set(ModuleContent.model_fields)


def test_each_question_type_in_the_bank_schema_requires_what_its_model_requires():
    variants = {variant["properties"]["type"]["const"]: variant for variant in load("question_bank.schema.json")["properties"]["questions"]["items"]["oneOf"]}
    for kind, model in {"mcq": Mcq, "msq": Msq, "true_false": TrueFalse, "order": Order}.items():
        assert set(variants[kind]["required"]) == required(model), kind
        assert set(variants[kind]["properties"]) == set(model.model_fields), kind


def test_the_bank_schema_allows_the_same_number_of_questions_as_the_model():
    questions = load("question_bank.schema.json")["properties"]["questions"]
    assert (questions["minItems"], questions["maxItems"]) == (6, 10)
