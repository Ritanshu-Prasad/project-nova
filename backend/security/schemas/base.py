"""security/schemas/base.py - Prototype-pollution-safe base model."""
from typing import Any

from pydantic import BaseModel, model_validator

_FORBIDDEN_KEYS: tuple[str, ...] = ("__proto__", "constructor", "prototype")


class SafeBaseModel(BaseModel):
    """Pydantic model that rejects prototype-pollution keys in payloads."""

    @model_validator(mode="before")
    @classmethod
    def reject_prototype_pollution(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key in _FORBIDDEN_KEYS:
                if key in data:
                    raise ValueError(f"Forbidden prototype pollution key: '{key}'")
        return data
