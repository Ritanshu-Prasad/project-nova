from typing import Literal

from pydantic import BaseModel, Field, field_validator

from course_models import Level
from prompts import sanitise, wrap_documents, wrap_goal

Mode = Literal["goal", "documents"]
Structure = Literal["chapters", "topics"]

MAX_OBJECTIVE_CHARS = 500
MAX_TITLE_CHARS = 200
MAX_SUMMARY_CHARS = 500


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

    @field_validator("objective", "course", "module", "topic", "summary")
    @classmethod
    def clean(cls, text: str) -> str:
        return sanitise(text, MAX_SUMMARY_CHARS)


def describe_request(request: CourseRequest, context: str) -> str:
    """The part of every prompt that says what the course is about."""
    if request.mode == "goal":
        return wrap_goal(request.objective)
    lines = [f"Build the course from these documents. Structure by {request.structure}."]
    if request.focus:
        lines.append(f"Focus on: {request.focus}")
    return "\n".join(lines) + f"\n\nDocuments:\n{wrap_documents(context)}"
