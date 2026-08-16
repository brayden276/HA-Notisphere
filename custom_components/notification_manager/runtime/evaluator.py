"""Pure AND condition evaluation over an injected state provider and clock."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, time
from typing import Protocol

from ..models import ConditionSpec, ConditionType

UNAVAILABLE_STATES = frozenset({"unavailable", "unknown"})


class StateProvider(Protocol):
    def get_state(self, entity_id: str) -> str | None: ...


@dataclass(frozen=True, slots=True)
class ConditionEvaluation:
    passed: bool
    reason: str | None = None
    unavailable: bool = False


class ConditionEvaluator:
    """Evaluate every condition with AND semantics and human skip reasons."""

    def __init__(self, state_provider: StateProvider, clock: Callable[[], datetime]) -> None:
        self._state_provider = state_provider
        self._clock = clock

    def evaluate(self, conditions: tuple[ConditionSpec, ...]) -> ConditionEvaluation:
        for condition in conditions:
            result = self._evaluate_one(condition)
            if not result.passed:
                return result
        return ConditionEvaluation(True)

    def _evaluate_one(self, condition: ConditionSpec) -> ConditionEvaluation:
        if condition.type is ConditionType.TIME_WINDOW:
            return self._time_window(condition)

        target = condition.target
        if target is None:
            return ConditionEvaluation(False, "Condition target is missing.", True)
        state = self._state_provider.get_state(target.entity_id)
        if not _state_is_available(state):
            return ConditionEvaluation(
                False,
                f"Condition skipped because {target.display_name_snapshot} is unavailable.",
                True,
            )

        assert state is not None
        if condition.type is ConditionType.PERSON_HOME:
            if state == "home":
                return ConditionEvaluation(True)
            return ConditionEvaluation(
                False, f"Condition not met: {target.display_name_snapshot} is not home."
            )
        if condition.type is ConditionType.PERSON_AWAY:
            if state != "home":
                return ConditionEvaluation(True)
            return ConditionEvaluation(
                False, f"Condition not met: {target.display_name_snapshot} is home."
            )
        if condition.type is ConditionType.ENTITY_STATE:
            expected = _string_parameter(condition.parameters, "state")
            if state == expected:
                return ConditionEvaluation(True)
            return ConditionEvaluation(
                False,
                f"Condition not met: {target.display_name_snapshot} is {state!r}, "
                f"not {expected!r}.",
            )
        return ConditionEvaluation(False, "Condition type is not supported.", True)

    def _time_window(self, condition: ConditionSpec) -> ConditionEvaluation:
        start = time.fromisoformat(_string_parameter(condition.parameters, "start"))
        end = time.fromisoformat(_string_parameter(condition.parameters, "end"))
        current = self._clock().timetz().replace(tzinfo=None)
        start = start.replace(tzinfo=None)
        end = end.replace(tzinfo=None)
        inside = True if start == end else (
            start <= current < end if start < end else current >= start or current < end
        )
        if inside:
            return ConditionEvaluation(True)
        return ConditionEvaluation(
            False,
            f"Condition not met: current time is outside {start.isoformat(timespec='minutes')}-"
            f"{end.isoformat(timespec='minutes')}.",
        )


def _state_is_available(state: str | None) -> bool:
    return state is not None and state.casefold() not in UNAVAILABLE_STATES


def _string_parameter(parameters: object, name: str) -> str:
    if not isinstance(parameters, Mapping):
        raise ValueError("Condition parameters must be an object")
    value = parameters.get(name)
    if not isinstance(value, str):
        raise ValueError(f"Condition parameter {name!r} must be a string")
    return value


__all__ = [
    "UNAVAILABLE_STATES",
    "ConditionEvaluation",
    "ConditionEvaluator",
    "StateProvider",
]
