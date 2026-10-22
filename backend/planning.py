import asyncio
from pathlib import Path
from typing import List

from pydantic import BaseModel, Field, field_validator

import llm
from chunking import Group, build_overview
from course_models import TopicKind
from course_requests import MAX_TITLE_CHARS, CourseRequest, describe_request
from pdf_parser import Document
from text_clean import Clean, Heading
from progress import Report, ignore
from prompts import module_system, outline_system

MAX_MODULES = 6
MAX_TOPICS_PER_MODULE = 5
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
    modules: List[OutlineModule] = Field(min_length=1)
    # What the model proposed before anything was trimmed, so the learner can be told.
    planned_modules: int = 0
    planned_topics: int = 0


# --- From a goal ---

async def plan_outline(request: CourseRequest, report: Report = ignore) -> Outline:
    report("outline", "Planning your modules")
    return await llm.ask(Outline, outline_system(), describe_request(request, ""), OUTLINE_TOKENS, kind="outline")


def fit_outline(outline: Outline) -> Outline:
    """Trims a course only when it is far bigger than a learner could use, remembers what was planned, and gives every topic its own planet name."""
    modules = [module.model_copy(update={"topics": module.topics[:MAX_TOPICS_PER_MODULE]}) for module in outline.modules[:MAX_MODULES]]
    planned = {"planned_modules": len(outline.modules), "planned_topics": sum(len(module.topics) for module in outline.modules)}
    return named_planets(outline.model_copy(update={"modules": modules, **planned}))


# --- Planet names ---

BANNED_PLANETS = {"nova"}
STAR_NAMES = ["Vega", "Lyra", "Mira", "Altair", "Sirius", "Rigel", "Deneb", "Capella", "Antares", "Spica", "Arcturus", "Procyon", "Castor", "Pollux", "Algol", "Mizar", "Polaris", "Aldebaran", "Bellatrix", "Canopus", "Fomalhaut", "Regulus", "Hadar", "Elnath", "Alnitak", "Mintaka", "Saiph", "Thuban"]


def named_planets(outline: Outline) -> Outline:
    """A planet name that is the product's own ("Nova"), or that an earlier topic already has, is replaced by an unused star name."""
    taken = {topic.planet.casefold() for module in outline.modules for topic in module.topics} | BANNED_PLANETS
    spare = (name for name in STAR_NAMES if name.casefold() not in taken)
    seen: set[str] = set()
    modules = []
    for module in outline.modules:
        topics = []
        for topic in module.topics:
            name = topic.planet.casefold()
            if name in BANNED_PLANETS or name in seen or not name:
                topic = topic.model_copy(update={"planet": next(spare, f"Orbit {len(seen) + 1}")})
            seen.add(topic.planet.casefold())
            topics.append(topic)
        modules.append(module.model_copy(update={"topics": topics}))
    return outline.model_copy(update={"modules": modules})


# --- From documents ---

async def plan_document_outline(request: CourseRequest, documents: List[Document], groups: List[Group], terms: List[str], report: Report = ignore) -> Outline:
    """One module per group of sections, planned in parallel; the course is named after its documents."""
    report("outline", f"Planning {len(groups)} modules from your documents")
    modules = await asyncio.gather(*(_plan_module(request, group, terms) for group in groups))
    names = [Path(document.name).stem.replace("_", " ").replace("-", " ").strip().title() for document in documents]
    subtitle = f"Built from {len(documents)} document{'s' if len(documents) > 1 else ''}"
    return named_planets(Outline(title=" & ".join(names)[:MAX_TITLE_CHARS], subtitle=subtitle, modules=modules))


async def _plan_module(request: CourseRequest, group: Group, terms: List[str]) -> OutlineModule:
    user = describe_request(request, build_overview([group], terms, MODULE_OVERVIEW_CHARS))
    module = await llm.ask(OutlineModule, module_system(), user, MODULE_TOKENS, kind="module")
    return module.model_copy(update={"topics": module.topics[:DOCUMENT_TOPICS_PER_MODULE]})
