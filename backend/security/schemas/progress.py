"""security/schemas/progress.py - Typed progress-save schemas."""
import re
from typing import Dict, List, Literal, Optional

from pydantic import ConfigDict, Field, field_validator

from security.schemas.base import SafeBaseModel

HEX_COLOR_REGEX = re.compile(r"^#[0-9a-fA-F]{3,8}$")
HTML_CHARS = re.compile(r"[\x00-\x1f\x7f<>&\"']")


class StatsSyncModel(SafeBaseModel):
    xp: int = Field(0, ge=0, le=10_000_000)
    streak: int = Field(0, ge=0, le=10_000)
    bestStreak: int = Field(0, ge=0, le=10_000)
    correct: int = Field(0, ge=0, le=500_000)
    answered: int = Field(0, ge=0, le=500_000)
    day: Optional[str] = Field(None, max_length=20)
    dayQuizzes: Optional[int] = Field(0, ge=0, le=1000)


class ProfileSyncModel(SafeBaseModel):
    callsign: str = Field("", max_length=50)
    avatar: Optional[str] = Field("", max_length=600_000)
    themeColor: str = Field("#06b6d4", max_length=25)
    activeObjective: Optional[str] = Field(None, max_length=500)

    @field_validator("callsign")
    @classmethod
    def sanitize_callsign(cls, v: str) -> str:
        return HTML_CHARS.sub("", str(v or "")).strip()[:50]

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, v: Optional[str]) -> str:
        if not v:
            return ""
        s = str(v).strip()
        if s.startswith(("data:image/", "http://", "https://", "/")):
            return s
        raise ValueError("Invalid avatar URI format")

    @field_validator("themeColor")
    @classmethod
    def validate_theme_color(cls, v: str) -> str:
        if not HEX_COLOR_REGEX.match(v):
            raise ValueError("Invalid hex color code")
        return v


class PilotSaveModel(SafeBaseModel):
    model_config = ConfigDict(extra="allow")  # keep client keys this schema doesn't model (course, hub, tutor)

    v: Literal[1] = 1
    profile: ProfileSyncModel = Field(default_factory=ProfileSyncModel)
    stats: StatsSyncModel = Field(default_factory=StatsSyncModel)
    library: Dict[str, dict] = Field(default_factory=dict)
    quizzes: List[dict] = Field(default_factory=list, max_length=100)


class ProgressPayload(SafeBaseModel):
    savedAt: float
    base: Optional[float] = None
    save: PilotSaveModel
