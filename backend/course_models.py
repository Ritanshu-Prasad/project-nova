import re
from typing import Annotated, Any, Callable, Literal, Optional, Union

from pydantic import BaseModel, BeforeValidator, Field, TypeAdapter, ValidationError, field_validator, model_validator

Level = Literal["beginner", "intermediate", "advanced"]
TopicKind = Literal["concept", "programming", "math", "science", "humanities", "language", "document"]

MIN_QUESTIONS = 6


# --- Lenient lists: invalid items are dropped instead of failing the whole object ---

def drop_invalid(model: Any) -> Callable[[Any], list]:
    adapter = TypeAdapter(model)

    def parse(raw: Any) -> list:
        if not isinstance(raw, list):
            return []
        items = []
        for item in raw:
            try:
                items.append(adapter.validate_python(item))
            except ValidationError:
                continue
        return items

    return parse


# --- Lesson blocks ---

class Text(BaseModel):
    type: Literal["text"]
    title: Optional[str] = None
    body: str = Field(min_length=1)


class Analogy(BaseModel):
    type: Literal["analogy"]
    body: str = Field(min_length=1)


class Term(BaseModel):
    term: str = Field(min_length=1)
    # `def` is a Python keyword, so the field is aliased
    definition: str = Field(alias="def", min_length=1)


class KeyTerms(BaseModel):
    type: Literal["keyTerms"]
    terms: list[Term] = Field(min_length=1)


class Steps(BaseModel):
    type: Literal["steps"]
    title: Optional[str] = None
    steps: list[str] = Field(min_length=1)


class Code(BaseModel):
    type: Literal["code"]
    language: str = "text"
    code: str = Field(min_length=1)
    caption: Optional[str] = None


class Formula(BaseModel):
    type: Literal["formula"]
    expr: str = Field(min_length=1)
    caption: Optional[str] = None


class Compare(BaseModel):
    type: Literal["compare"]
    title: Optional[str] = None
    columns: tuple[str, str]
    rows: list[tuple[str, str, str]] = Field(min_length=1)


class Example(BaseModel):
    type: Literal["example"]
    title: Optional[str] = None
    body: str = Field(min_length=1)


class Callout(BaseModel):
    type: Literal["callout"]
    tone: Literal["tip", "warning", "fact"] = "tip"
    body: str = Field(min_length=1)


class Source(BaseModel):
    type: Literal["source"]
    doc: str = "Document"
    page: Optional[int] = None
    excerpt: str = Field(min_length=1)


class Summary(BaseModel):
    type: Literal["summary"]
    points: list[str] = Field(min_length=1)


Block = Annotated[
    Union[Text, Analogy, KeyTerms, Steps, Code, Formula, Compare, Example, Callout, Source, Summary],
    Field(discriminator="type"),
]


# --- Questions ---

class QuestionBase(BaseModel):
    q: str = Field(min_length=1)
    why: str = ""
    difficulty: int = Field(default=1, ge=1, le=3)


class Mcq(QuestionBase):
    type: Literal["mcq"]
    options: list[str] = Field(min_length=2)
    answer: int

    @model_validator(mode="after")
    def answer_in_range(self):
        if not 0 <= self.answer < len(self.options):
            raise ValueError("answer is outside the options")
        return self


class Multi(QuestionBase):
    type: Literal["multi"]
    options: list[str] = Field(min_length=2)
    answers: list[int] = Field(min_length=1)

    @model_validator(mode="after")
    def answers_in_range(self):
        if any(not 0 <= a < len(self.options) for a in self.answers):
            raise ValueError("an answer is outside the options")
        return self


class TrueFalse(QuestionBase):
    type: Literal["truefalse"]
    answer: bool


class Fill(QuestionBase):
    type: Literal["fill"]
    answer: str = Field(min_length=1)
    accept: Optional[list[str]] = None


class CodeCheck(BaseModel):
    label: str
    pattern: str

    @field_validator("pattern")
    @classmethod
    def compiles(cls, pattern: str) -> str:
        try:
            re.compile(pattern)
        except re.error as error:
            raise ValueError(f"invalid pattern: {error}")
        return pattern


class CodeQuestion(QuestionBase):
    type: Literal["code"]
    language: str = "text"
    starter: Optional[str] = None
    solution: str = Field(min_length=1)
    checks: list[CodeCheck] = Field(min_length=1)


class Order(QuestionBase):
    type: Literal["order"]
    items: list[str] = Field(min_length=3)


class Match(QuestionBase):
    type: Literal["match"]
    pairs: list[tuple[str, str]] = Field(min_length=2)


Question = Annotated[
    Union[Mcq, Multi, TrueFalse, Fill, CodeQuestion, Order, Match],
    Field(discriminator="type"),
]

Blocks = Annotated[list[Block], BeforeValidator(drop_invalid(Block))]
Questions = Annotated[list[Question], BeforeValidator(drop_invalid(Question))]


# --- Course structure ---

class Lesson(BaseModel):
    minutes: int = Field(default=5, ge=1)
    objectives: list[str] = Field(default_factory=list)
    simple: str = ""
    blocks: Blocks = Field(min_length=1)


class QuestionList(BaseModel):
    """What the model writes for one batch of questions."""
    questions: Questions

    @field_validator("questions")
    @classmethod
    def enough_questions(cls, questions: list) -> list:
        if len(questions) < MIN_QUESTIONS:
            raise ValueError("not enough valid questions")
        return questions


class Topic(BaseModel):
    id: str
    title: str
    planet: str
    kind: TopicKind
    summary: str
    lesson: Lesson
    quiz: list[Question]
    practice: list[Question]


class LessonStub(BaseModel):
    """Placeholder lesson of a topic that is written when the learner first opens it."""
    minutes: int = 5
    objectives: list[str] = Field(default_factory=list)
    simple: str = ""
    blocks: list = Field(default_factory=list)


class TopicStub(BaseModel):
    id: str
    title: str
    planet: str
    kind: TopicKind
    summary: str
    loaded: Literal[False] = False
    lesson: LessonStub
    quiz: list = Field(default_factory=list)
    practice: list = Field(default_factory=list)


class Module(BaseModel):
    id: str
    title: str
    topics: list[Union[Topic, TopicStub]]
    quiz: Optional[list[Question]] = None


class CourseDocument(BaseModel):
    name: str
    pages: int


class Course(BaseModel):
    id: str
    title: str
    subtitle: str
    objective: str
    level: Level
    source: Literal["ai", "documents"]
    modules: list[Module]
    documents: Optional[list[CourseDocument]] = None
