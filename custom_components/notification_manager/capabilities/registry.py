"""Pure registry translating Home Assistant targets into human semantics."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import time

from ..models import JsonValue, TargetRef, TriggerType
from .models import (
    CapabilityTarget,
    ParameterSchema,
    ParameterType,
    ResolvedTrigger,
    Semantic,
    SemanticChoice,
    TargetCategory,
    TargetSnapshot,
)

SYNTHETIC_TIME_TARGET = "notification_manager.time"

_DURATION = ParameterSchema(
    key="duration_seconds",
    type=ParameterType.INTEGER,
    label="For",
    unit="seconds",
    minimum=1,
)
_THRESHOLD = ParameterSchema(
    key="threshold",
    type=ParameterType.NUMBER,
    label="Value",
)
_AT = ParameterSchema(key="at", type=ParameterType.TIME, label="Time")


class CapabilityRegistryError(ValueError):
    """Base error with a stable websocket-compatible code."""

    code = "capability_error"


class TargetNotFoundError(CapabilityRegistryError):
    code = "target_not_found"

    def __init__(self, entity_id: str) -> None:
        super().__init__(f"Target {entity_id!r} was not found.")


class UnsupportedTargetError(CapabilityRegistryError):
    code = "unsupported_target"

    def __init__(self, target: TargetSnapshot) -> None:
        target_type = target.domain
        if target.device_class:
            target_type = f"{target_type}/{target.device_class}"
        super().__init__(f"Target type {target_type!r} is not supported.")


class UnsupportedSemanticError(CapabilityRegistryError):
    code = "unsupported_semantic"

    def __init__(self, entity_id: str, semantic: str) -> None:
        super().__init__(f"Semantic {semantic!r} is not supported for {entity_id!r}.")


class InvalidCapabilityParametersError(CapabilityRegistryError):
    code = "invalid_capability_parameters"


@dataclass(frozen=True, slots=True)
class _RawMapping:
    type: TriggerType
    state: str | None = None
    duration: bool = False
    direction: str | None = None


@dataclass(frozen=True, slots=True)
class _Definition:
    category: TargetCategory
    choices: tuple[SemanticChoice, ...]
    mappings: Mapping[Semantic, _RawMapping]


def _choice(
    semantic: Semantic, label: str, *parameters: ParameterSchema
) -> SemanticChoice:
    return SemanticChoice(semantic, label, tuple(parameters))


_OPENING = _Definition(
    TargetCategory.OPENING,
    (
        _choice(Semantic.OPENED, "Opens"),
        _choice(Semantic.CLOSED, "Closes"),
        _choice(Semantic.REMAINS_OPEN, "Remains open", _DURATION),
        _choice(Semantic.REMAINS_CLOSED, "Remains closed", _DURATION),
    ),
    {
        Semantic.OPENED: _RawMapping(TriggerType.BINARY_STATE, state="on"),
        Semantic.CLOSED: _RawMapping(TriggerType.BINARY_STATE, state="off"),
        Semantic.REMAINS_OPEN: _RawMapping(
            TriggerType.BINARY_STATE_DURATION, state="on", duration=True
        ),
        Semantic.REMAINS_CLOSED: _RawMapping(
            TriggerType.BINARY_STATE_DURATION, state="off", duration=True
        ),
    },
)
_MOTION = _Definition(
    TargetCategory.MOTION,
    (
        _choice(Semantic.DETECTED, "Detects activity"),
        _choice(Semantic.CLEARED, "Clears"),
        _choice(Semantic.REMAINS_DETECTED, "Remains detected", _DURATION),
    ),
    {
        Semantic.DETECTED: _RawMapping(TriggerType.BINARY_STATE, state="on"),
        Semantic.CLEARED: _RawMapping(TriggerType.BINARY_STATE, state="off"),
        Semantic.REMAINS_DETECTED: _RawMapping(
            TriggerType.BINARY_STATE_DURATION, state="on", duration=True
        ),
    },
)
_PERSON = _Definition(
    TargetCategory.PERSON,
    (
        _choice(Semantic.ARRIVES, "Arrives home"),
        _choice(Semantic.LEAVES, "Leaves home"),
    ),
    {
        Semantic.ARRIVES: _RawMapping(TriggerType.PRESENCE, state="home"),
        Semantic.LEAVES: _RawMapping(TriggerType.PRESENCE, state="not_home"),
    },
)
_TIME = _Definition(
    TargetCategory.TIME,
    (_choice(Semantic.AT_TIME, "At a time", _AT),),
    {Semantic.AT_TIME: _RawMapping(TriggerType.TIME)},
)

_OPENING_CLASSES = frozenset({"door", "garage_door", "window", "opening"})
_MOTION_CLASSES = frozenset({"motion", "occupancy"})
_NUMERIC_CATEGORIES = {
    "temperature": TargetCategory.TEMPERATURE,
    "humidity": TargetCategory.HUMIDITY,
    "battery": TargetCategory.BATTERY,
}


class CapabilityRegistry:
    """Index supported semantics without depending on Home Assistant imports."""

    def __init__(self, snapshots: tuple[TargetSnapshot, ...] = ()) -> None:
        self._snapshots = {target.entity_id: target for target in snapshots}

    def replace(self, snapshots: tuple[TargetSnapshot, ...]) -> None:
        self._snapshots = {target.entity_id: target for target in snapshots}

    def targets(self) -> tuple[CapabilityTarget, ...]:
        supported = []
        for snapshot in self._snapshots.values():
            definition = self._definition(snapshot)
            if definition is not None:
                supported.append(self._target(snapshot, definition))
        supported.sort(key=lambda item: (item.category.value, item.display_name.casefold()))
        supported.append(self._time_target())
        return tuple(supported)

    def for_target(self, entity_id: str) -> CapabilityTarget:
        if entity_id == SYNTHETIC_TIME_TARGET:
            return self._time_target()
        snapshot = self._snapshots.get(entity_id)
        if snapshot is None:
            raise TargetNotFoundError(entity_id)
        definition = self._definition(snapshot)
        if definition is None:
            raise UnsupportedTargetError(snapshot)
        return self._target(snapshot, definition)

    def resolve(
        self,
        entity_id: str,
        semantic: Semantic | str,
        parameters: Mapping[str, object] | None = None,
    ) -> ResolvedTrigger:
        target = self.for_target(entity_id)
        try:
            selected = semantic if isinstance(semantic, Semantic) else Semantic(semantic)
        except ValueError as err:
            raise UnsupportedSemanticError(entity_id, str(semantic)) from err
        definition = _TIME if target.synthetic else self._definition(self._snapshots[entity_id])
        assert definition is not None
        mapping = definition.mappings.get(selected)
        if mapping is None:
            raise UnsupportedSemanticError(entity_id, selected.value)
        values = self._validated_parameters(
            entity_id,
            selected,
            next(choice for choice in target.semantics if choice.semantic is selected),
            parameters or {},
        )
        raw: dict[str, JsonValue] = {}
        if mapping.state is not None:
            raw["state"] = mapping.state
        if mapping.duration:
            raw["duration_seconds"] = values["duration_seconds"]
        if mapping.direction is not None:
            raw["direction"] = mapping.direction
        if selected in {Semantic.ABOVE, Semantic.BELOW}:
            raw["threshold"] = values["threshold"]
            raw["direction"] = selected.value
        if selected is Semantic.AT_TIME:
            raw["at"] = values["at"]
        target_ref = None if target.synthetic else TargetRef(
            entity_id=target.entity_id,
            registry_id=target.registry_id,
            device_id=target.device_id,
            domain=target.domain,
            device_class=target.device_class,
            display_name_snapshot=target.display_name,
        )
        return ResolvedTrigger(mapping.type, target_ref, raw)

    @staticmethod
    def _definition(snapshot: TargetSnapshot) -> _Definition | None:
        if snapshot.domain == "binary_sensor":
            if snapshot.device_class in _OPENING_CLASSES:
                return _OPENING
            if snapshot.device_class in _MOTION_CLASSES:
                return _MOTION
            return None
        if snapshot.domain == "person":
            return _PERSON
        if snapshot.domain == "sensor" and snapshot.device_class in _NUMERIC_CATEGORIES:
            category = _NUMERIC_CATEGORIES[snapshot.device_class]
            choices = (
                _choice(Semantic.ABOVE, "Rises above", _THRESHOLD),
                _choice(Semantic.BELOW, "Falls below", _THRESHOLD),
            )
            return _Definition(
                category,
                choices,
                {
                    Semantic.ABOVE: _RawMapping(TriggerType.NUMERIC_THRESHOLD),
                    Semantic.BELOW: _RawMapping(TriggerType.NUMERIC_THRESHOLD),
                },
            )
        return None

    @staticmethod
    def _target(snapshot: TargetSnapshot, definition: _Definition) -> CapabilityTarget:
        choices = tuple(choice.with_unit(snapshot.unit) for choice in definition.choices)
        return CapabilityTarget(
            entity_id=snapshot.entity_id,
            display_name=snapshot.display_name,
            domain=snapshot.domain,
            device_class=snapshot.device_class,
            category=definition.category,
            available=snapshot.available,
            semantics=choices,
            registry_id=snapshot.registry_id,
            device_id=snapshot.device_id,
            device_name=snapshot.device_name,
            unit=snapshot.unit,
        )

    @staticmethod
    def _time_target() -> CapabilityTarget:
        return CapabilityTarget(
            entity_id=SYNTHETIC_TIME_TARGET,
            display_name="Time",
            domain="notification_manager",
            device_class="time",
            category=TargetCategory.TIME,
            available=True,
            semantics=_TIME.choices,
            synthetic=True,
        )

    @staticmethod
    def _validated_parameters(
        entity_id: str,
        semantic: Semantic,
        choice: SemanticChoice,
        parameters: Mapping[str, object],
    ) -> dict[str, JsonValue]:
        expected = {parameter.key: parameter for parameter in choice.parameters}
        unknown = sorted(set(parameters) - set(expected))
        if unknown:
            raise InvalidCapabilityParametersError(
                f"Unexpected parameters for {semantic.value} on {entity_id!r}: "
                f"{', '.join(unknown)}."
            )
        result: dict[str, JsonValue] = {}
        for key, schema in expected.items():
            value = parameters.get(key)
            if value is None:
                raise InvalidCapabilityParametersError(
                    f"Parameter {key!r} is required for {semantic.value}."
                )
            if schema.type is ParameterType.NUMBER:
                if not isinstance(value, (int, float)) or isinstance(value, bool):
                    raise InvalidCapabilityParametersError(f"Parameter {key!r} must be numeric.")
            elif schema.type is ParameterType.INTEGER:
                if not isinstance(value, int) or isinstance(value, bool):
                    raise InvalidCapabilityParametersError(f"Parameter {key!r} must be an integer.")
            elif schema.type is ParameterType.TIME:
                value = CapabilityRegistry._validated_time(key, value)
            if (
                schema.minimum is not None
                and isinstance(value, (int, float))
                and value < schema.minimum
            ):
                raise InvalidCapabilityParametersError(
                    f"Parameter {key!r} must be at least {schema.minimum}."
                )
            result[key] = value
        return result

    @staticmethod
    def _validated_time(key: str, value: object) -> str:
        if not isinstance(value, str):
            raise InvalidCapabilityParametersError(f"Parameter {key!r} must be a time.")
        try:
            time.fromisoformat(value)
        except ValueError as err:
            raise InvalidCapabilityParametersError(
                f"Parameter {key!r} must be an ISO local time."
            ) from err
        return value


__all__ = [
    "SYNTHETIC_TIME_TARGET",
    "CapabilityRegistry",
    "CapabilityRegistryError",
    "InvalidCapabilityParametersError",
    "TargetNotFoundError",
    "UnsupportedSemanticError",
    "UnsupportedTargetError",
]
