"""Home Assistant-independent capability discovery models."""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import StrEnum

from ..models import JsonValue, TargetRef, TriggerType


class Semantic(StrEnum):
    """Human event names accepted by the notification rule editor."""

    OPENED = "OPENED"
    CLOSED = "CLOSED"
    REMAINS_OPEN = "REMAINS_OPEN"
    REMAINS_CLOSED = "REMAINS_CLOSED"
    DETECTED = "DETECTED"
    CLEARED = "CLEARED"
    REMAINS_DETECTED = "REMAINS_DETECTED"
    ARRIVES = "ARRIVES"
    LEAVES = "LEAVES"
    ABOVE = "ABOVE"
    BELOW = "BELOW"
    AT_TIME = "AT_TIME"


class TargetCategory(StrEnum):
    """Stable editor groupings independent of Home Assistant presentation text."""

    OPENING = "opening"
    MOTION = "motion"
    PERSON = "person"
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    BATTERY = "battery"
    TIME = "time"


class ParameterType(StrEnum):
    NUMBER = "number"
    INTEGER = "integer"
    TIME = "time"


@dataclass(frozen=True, slots=True)
class ParameterSchema:
    """A serialisable input contract for one semantic choice."""

    key: str
    type: ParameterType
    label: str
    required: bool = True
    unit: str | None = None
    minimum: int | float | None = None

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "key": self.key,
            "type": self.type.value,
            "label": self.label,
            "required": self.required,
            "unit": self.unit,
            "minimum": self.minimum,
        }


@dataclass(frozen=True, slots=True)
class SemanticChoice:
    """A human semantic and the values required to configure it."""

    semantic: Semantic
    label: str
    parameters: tuple[ParameterSchema, ...] = ()

    def with_unit(self, unit: str | None) -> SemanticChoice:
        return replace(
            self,
            parameters=tuple(
                replace(parameter, unit=unit)
                if parameter.key == "threshold"
                else parameter
                for parameter in self.parameters
            ),
        )

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "semantic": self.semantic.value,
            "label": self.label,
            "parameters": [parameter.to_dict() for parameter in self.parameters],
        }


@dataclass(frozen=True, slots=True)
class TargetSnapshot:
    """Small, immutable snapshot supplied by the Home Assistant adapter."""

    entity_id: str
    domain: str
    display_name: str
    device_class: str | None
    available: bool
    registry_id: str | None = None
    device_id: str | None = None
    unit: str | None = None
    device_name: str | None = None


@dataclass(frozen=True, slots=True)
class CapabilityTarget:
    """Frontend-safe target description; it deliberately contains no raw HA states."""

    entity_id: str
    display_name: str
    domain: str
    device_class: str | None
    category: TargetCategory
    available: bool
    semantics: tuple[SemanticChoice, ...]
    registry_id: str | None = None
    device_id: str | None = None
    device_name: str | None = None
    unit: str | None = None
    synthetic: bool = False

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "entity_id": self.entity_id,
            "display_name": self.display_name,
            "domain": self.domain,
            "device_class": self.device_class,
            "category": self.category.value,
            "available": self.available,
            "registry_id": self.registry_id,
            "device_id": self.device_id,
            "device_name": self.device_name,
            "unit": self.unit,
            "synthetic": self.synthetic,
            "semantics": [choice.to_dict() for choice in self.semantics],
        }


@dataclass(frozen=True, slots=True)
class ResolvedTrigger:
    """Backend-only translation from a semantic choice to the canonical trigger model."""

    type: TriggerType
    target: TargetRef | None
    parameters: dict[str, JsonValue]

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "type": self.type.value,
            "target": self.target.to_dict() if self.target else None,
            "parameters": dict(self.parameters),
        }


__all__ = [
    "CapabilityTarget",
    "ParameterSchema",
    "ParameterType",
    "ResolvedTrigger",
    "Semantic",
    "SemanticChoice",
    "TargetCategory",
    "TargetSnapshot",
]
