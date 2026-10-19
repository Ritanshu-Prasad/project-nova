from typing import Literal

from pydantic import BaseModel, Field, field_validator

from course_models import Level
from prompts import sanitise, wrap_documents, wrap_goal

Mode = Literal["goal", "documents"]
Structure = Literal["chapters", "topics"]

MAX_OBJECTIVE_CHARS = 500
MAX_TITLE_CHARS = 200
MAX_SUMMARY_CHARS = 500
MAX_OUTLINE_TOPICS = 40
MAX_TAUGHT_TOPICS = 6
MAX_TAUGHT_ITEMS = 12
MAX_TAUGHT_CHARS = 300


class CourseRequest(BaseModel):
    mode: Mode
    level: Level
    objective: str = ""
    focus: str = ""
    structure: Structure = "chapters"

    @field_validator("objective", "focus")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, MAX_OBJECTIVE_CHARS)


class TopicRequest(BaseModel):
    level: Level
    objective: str = Field(max_length=MAX_OBJECTIVE_CHARS)
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
    level: Level
    objective: str = Field(max_length=MAX_OBJECTIVE_CHARS)
    module: str = Field(max_length=MAX_TITLE_CHARS)
    topics: list[TaughtTopic] = Field(min_length=1, max_length=MAX_TAUGHT_TOPICS)

    @field_validator("objective", "module")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, MAX_SUMMARY_CHARS)


def describe_topic(module_title: str, topic_title: str, summary: str, outline: list[str], previous: str) -> str:
    """The part of a topic prompt that says which topic to write and where it sits in the course."""
    lines = [f'Topic: "{topic_title}" ({summary}) from the module "{module_title}".']
    if outline:
        lines.append("Course outline: " + "; ".join(f"{number}. {title}" for number, title in enumerate(outline, start=1)))
    if previous:
        lines.append(f"The previous topic covered: {previous}")
    return "\n".join(lines)


def describe_taught(module_title: str, topics: list[TaughtTopic]) -> str:
    """What the learner has been taught in a module, as the material for its quiz."""
    lines = [f'End-of-module quiz for the module "{module_title}". Ask only about what was taught:']
    for topic in topics:
        lines.append(f"- {topic.title}")
        lines += [f"  Objective: {objective}" for objective in topic.objectives]
        lines += [f"  Term: {term}" for term in topic.terms]
        lines += [f"  Point: {point}" for point in topic.points]
    return "\n".join(lines)


def describe_request(request: CourseRequest, context: str) -> str:
    """The part of every prompt that says what the course is about."""
    if request.mode == "goal":
        return wrap_goal(request.objective)
    lines = [f"Build the course from these documents. Structure by {request.structure}."]
    if request.focus:
        lines.append(f"Focus on: {request.focus}")
    return "\n".join(lines) + f"\n\nDocuments:\n{wrap_documents(context)}"
