from typing import Literal

from pydantic import BaseModel, Field, field_validator

from prompts import EXPECTATIONS_TAG, sanitise, wrap_documents, wrap_goal

Mode = Literal["goal", "documents"]
Structure = Literal["chapters", "topics"]

MAX_OBJECTIVE_CHARS = 500
MAX_EXPECTATION_CHARS = 1000
MAX_TITLE_CHARS = 200
MAX_SUMMARY_CHARS = 500
MAX_OUTLINE_TOPICS = 40
MAX_TAUGHT_TOPICS = 6
MAX_TAUGHT_ITEMS = 12
MAX_TAUGHT_CHARS = 300


class CourseRequest(BaseModel):
    mode: Mode
    objective: str = ""
    expectations: str = ""
    focus: str = ""
    structure: Structure = "chapters"

    @field_validator("objective", "focus")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, MAX_OBJECTIVE_CHARS)

    @field_validator("expectations")
    @classmethod
    def clean_expectations(cls, text: str) -> str:
        return sanitise(text, MAX_EXPECTATION_CHARS)


class TopicRequest(BaseModel):
    objective: str = Field(max_length=MAX_OBJECTIVE_CHARS)
    expectations: str = Field(default="", max_length=MAX_EXPECTATION_CHARS)
    course: str = Field(max_length=MAX_TITLE_CHARS)
    module: str = Field(max_length=MAX_TITLE_CHARS)
    topic: str = Field(max_length=MAX_TITLE_CHARS)
    summary: str = Field(default="", max_length=MAX_SUMMARY_CHARS)
    # The titles of every topic in the course, in order, and what the topic before this one covered.
    outline: list[str] = Field(default_factory=list, max_length=MAX_OUTLINE_TOPICS)
    previous: str = Field(default="", max_length=MAX_SUMMARY_CHARS)

    @field_validator("objective", "course", "module", "topic", "summary", "previous")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, MAX_SUMMARY_CHARS)

    @field_validator("expectations")
    @classmethod
    def clean_expectations(cls, text: str) -> str:
        return sanitise(text, MAX_EXPECTATION_CHARS)

    @field_validator("outline")
    @classmethod
    def clean_titles(cls, titles: list[str]) -> list[str]:
        return [sanitise(title, MAX_TITLE_CHARS) for title in titles]


class TaughtTopic(BaseModel):
    """What a learner was actually taught in one topic: the base for that module's quiz."""
    title: str = Field(max_length=MAX_TITLE_CHARS)
    objectives: list[str] = Field(default_factory=list, max_length=MAX_TAUGHT_ITEMS)
    terms: list[str] = Field(default_factory=list, max_length=MAX_TAUGHT_ITEMS)
    points: list[str] = Field(default_factory=list, max_length=MAX_TAUGHT_ITEMS)

    @field_validator("title", "objectives", "terms", "points", mode="after")
    @classmethod
    def clean(cls, value):
        if isinstance(value, str):
            return sanitise(value, MAX_TAUGHT_CHARS)
        return [sanitise(item, MAX_TAUGHT_CHARS) for item in value]


class ModuleQuizRequest(BaseModel):
    objective: str = Field(max_length=MAX_OBJECTIVE_CHARS)
    module: str = Field(max_length=MAX_TITLE_CHARS)
    topics: list[TaughtTopic] = Field(min_length=1, max_length=MAX_TAUGHT_TOPICS)

    @field_validator("objective", "module")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, MAX_SUMMARY_CHARS)


def describe_request(request: CourseRequest, context: str) -> str:
    """The part of every prompt that says what the course is about."""
    wishes = f"\nLearner expectations: <{EXPECTATIONS_TAG}>{request.expectations}</{EXPECTATIONS_TAG}>" if request.expectations else ""
    if request.mode == "goal":
        return wrap_goal(request.objective) + wishes
    lines = [f"Build the course from these documents. Structure by {request.structure}." + wishes]
    if request.focus:
        lines.append(f"Focus on: {request.focus}")
    return "\n".join(lines) + f"\n\nDocuments:\n{wrap_documents(context)}"
