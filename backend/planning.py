import asyncio
from pathlib import Path
from typing import List, Literal

from pydantic import BaseModel, Field, field_validator

import llm
from chunking import Group, build_overview
from course_models import TopicKind
from course_requests import MAX_TITLE_CHARS, CourseRequest, describe_request
from pdf_parser import Document
from text_clean import Clean, Heading
from progress import Report, ignore
from prompts import module_system, outline_system

Scope = Literal["narrow", "broad"]

OUTLINE_LIMITS = {"narrow": (3, 3), "broad": (6, 4)}
DOCUMENT_TOPICS_PER_MODULE = 3
MODULE_OVERVIEW_CHARS = 8000
OUTLINE_TOKENS = 3000
MODULE_TOKENS = 2500


# --- Outline ---

class OutlineTopic(BaseModel):
    title: Heading
    planet: Clean
    kind: TopicKind = "concept"
    summary: Clean = ""
    minutes: int = 5

    @field_validator("kind", mode="before")
    @classmethod
    def known_kind(cls, kind: object) -> object:
        return kind if kind in TopicKind.__args__ else "concept"


class OutlineModule(BaseModel):
    title: Heading
    topics: List[OutlineTopic] = Field(min_length=1)


class Outline(BaseModel):
    title: Heading
    subtitle: Clean = ""
    scope: Scope = "broad"
    modules: List[OutlineModule] = Field(min_length=1)

    @field_validator("scope", mode="before")
    @classmethod
    def known_scope(cls, scope: object) -> object:
        return scope if scope in OUTLINE_LIMITS else "broad"


# --- From a goal ---

async def plan_outline(request: CourseRequest, report: Report = ignore) -> Outline:
    report("outline", "Planning your modules")
    return await llm.ask(Outline, outline_system(), describe_request(request, ""), OUTLINE_TOKENS, kind="outline")


def fit_outline(outline: Outline) -> Outline:
    """Keeps the course within the size of its scope, whatever the model returned."""
    max_modules, max_topics = OUTLINE_LIMITS[outline.scope]
    modules = [module.model_copy(update={"topics": module.topics[:max_topics]}) for module in outline.modules[:max_modules]]
    return outline.model_copy(update={"modules": modules})


# --- From documents ---

async def plan_document_outline(request: CourseRequest, documents: List[Document], groups: List[Group], terms: List[str], report: Report = ignore) -> Outline:
    """One module per group of sections, planned in parallel; the course is named after its documents."""
    report("outline", f"Planning {len(groups)} modules from your documents")
    modules = await asyncio.gather(*(_plan_module(request, group, terms) for group in groups))
    names = [Path(document.name).stem.replace("_", " ").replace("-", " ").strip().title() for document in documents]
    subtitle = f"Built from {len(documents)} document{'s' if len(documents) > 1 else ''}"
    return Outline(title=" & ".join(names)[:MAX_TITLE_CHARS], subtitle=subtitle, modules=modules)


async def _plan_module(request: CourseRequest, group: Group, terms: List[str]) -> OutlineModule:
    user = describe_request(request, build_overview([group], terms, MODULE_OVERVIEW_CHARS))
    module = await llm.ask(OutlineModule, module_system(), user, MODULE_TOKENS, kind="module")
    return module.model_copy(update={"topics": module.topics[:DOCUMENT_TOPICS_PER_MODULE]})
