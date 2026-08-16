from __future__ import annotations

import pytest

from custom_components.notification_manager.capabilities import (
    SYNTHETIC_TIME_TARGET,
    CapabilityRegistry,
    HomeAssistantCapabilityDiscovery,
    InvalidCapabilityParametersError,
    Semantic,
    TargetSnapshot,
    UnsupportedSemanticError,
    UnsupportedTargetError,
)
from custom_components.notification_manager.models import TriggerType


def snapshot(
    entity_id: str,
    device_class: str | None,
    *,
    available: bool = True,
    unit: str | None = None,
) -> TargetSnapshot:
    return TargetSnapshot(
        entity_id=entity_id,
        domain=entity_id.partition(".")[0],
        display_name=entity_id.rpartition(".")[2].replace("_", " ").title(),
        device_class=device_class,
        available=available,
        registry_id=f"registry-{entity_id}",
        device_id="device-1",
        unit=unit,
        device_name="Hallway device",
    )


@pytest.mark.parametrize("device_class", ["door", "garage_door", "window", "opening"])
def test_opening_classes_expose_human_semantics_without_raw_states(
    device_class: str,
) -> None:
    registry = CapabilityRegistry(
        (snapshot("binary_sensor.garage", device_class, available=False),)
    )

    target = registry.for_target("binary_sensor.garage")

    assert target.available is False
    assert target.category.value == "opening"
    assert [choice.semantic for choice in target.semantics] == [
        Semantic.OPENED,
        Semantic.CLOSED,
        Semantic.REMAINS_OPEN,
        Semantic.REMAINS_CLOSED,
    ]
    payload = target.to_dict()
    assert payload["registry_id"] == "registry-binary_sensor.garage"
    assert payload["device_id"] == "device-1"
    assert all("state" not in choice for choice in payload["semantics"])

    resolved = registry.resolve("binary_sensor.garage", Semantic.REMAINS_OPEN, {
        "duration_seconds": 300
    })
    assert resolved.type is TriggerType.BINARY_STATE_DURATION
    assert resolved.parameters == {"state": "on", "duration_seconds": 300}


@pytest.mark.parametrize("device_class", ["motion", "occupancy"])
def test_activity_classes_expose_detected_cleared_and_duration(device_class: str) -> None:
    registry = CapabilityRegistry((snapshot("binary_sensor.activity", device_class),))
    target = registry.for_target("binary_sensor.activity")

    assert [choice.semantic for choice in target.semantics] == [
        Semantic.DETECTED,
        Semantic.CLEARED,
        Semantic.REMAINS_DETECTED,
    ]
    duration = target.semantics[-1].parameters[0]
    assert duration.to_dict() == {
        "key": "duration_seconds",
        "type": "integer",
        "label": "For",
        "required": True,
        "unit": "seconds",
        "minimum": 1,
    }


def test_person_and_synthetic_time_have_distinct_semantics() -> None:
    registry = CapabilityRegistry((snapshot("person.alice", None),))

    person = registry.for_target("person.alice")
    assert [choice.semantic for choice in person.semantics] == [
        Semantic.ARRIVES,
        Semantic.LEAVES,
    ]
    assert registry.resolve("person.alice", Semantic.ARRIVES).parameters == {"state": "home"}

    time_target = registry.for_target(SYNTHETIC_TIME_TARGET)
    assert time_target.synthetic is True
    assert time_target.available is True
    assert time_target.semantics[0].semantic is Semantic.AT_TIME
    assert time_target.semantics[0].parameters[0].type.value == "time"
    resolved = registry.resolve(SYNTHETIC_TIME_TARGET, Semantic.AT_TIME, {"at": "07:30"})
    assert resolved.type is TriggerType.TIME
    assert resolved.target is None
    assert resolved.parameters == {"at": "07:30"}


@pytest.mark.parametrize(
    ("device_class", "unit", "category"),
    [
        ("temperature", "°C", "temperature"),
        ("humidity", "%", "humidity"),
        ("battery", "%", "battery"),
    ],
)
def test_numeric_sensors_return_unit_aware_parameter_schemas(
    device_class: str, unit: str, category: str
) -> None:
    registry = CapabilityRegistry(
        (snapshot(f"sensor.{device_class}", device_class, unit=unit),)
    )
    target = registry.for_target(f"sensor.{device_class}")

    assert target.category.value == category
    assert target.unit == unit
    assert [choice.semantic for choice in target.semantics] == [Semantic.ABOVE, Semantic.BELOW]
    assert target.semantics[0].parameters[0].to_dict() == {
        "key": "threshold",
        "type": "number",
        "label": "Value",
        "required": True,
        "unit": unit,
        "minimum": None,
    }
    resolved = registry.resolve(
        f"sensor.{device_class}", Semantic.BELOW, {"threshold": 20.5}
    )
    assert resolved.parameters == {"threshold": 20.5, "direction": "BELOW"}


def test_unknown_device_classes_and_semantics_are_explicitly_rejected() -> None:
    registry = CapabilityRegistry(
        (
            snapshot("binary_sensor.smoke_alarm", "smoke"),
            snapshot("binary_sensor.door", "door"),
        )
    )

    assert "binary_sensor.smoke_alarm" not in {
        target.entity_id for target in registry.targets()
    }
    with pytest.raises(UnsupportedTargetError, match="binary_sensor/smoke"):
        registry.for_target("binary_sensor.smoke_alarm")
    with pytest.raises(UnsupportedSemanticError):
        registry.resolve("binary_sensor.door", Semantic.ABOVE, {"threshold": 1})


def test_parameter_schema_is_enforced_by_backend_resolution() -> None:
    registry = CapabilityRegistry((snapshot("binary_sensor.door", "door"),))

    with pytest.raises(InvalidCapabilityParametersError, match="required"):
        registry.resolve("binary_sensor.door", Semantic.REMAINS_OPEN)
    with pytest.raises(InvalidCapabilityParametersError, match="at least 1"):
        registry.resolve(
            "binary_sensor.door", Semantic.REMAINS_OPEN, {"duration_seconds": 0}
        )
    with pytest.raises(InvalidCapabilityParametersError, match="Unexpected"):
        registry.resolve("binary_sensor.door", Semantic.OPENED, {"state": "on"})


def test_home_assistant_discovery_cache_has_an_explicit_invalidation_hook() -> None:
    class FakeDiscovery(HomeAssistantCapabilityDiscovery):
        def __init__(self) -> None:
            super().__init__(object())
            self.snapshot_calls = 0

        def _snapshots(self) -> tuple[TargetSnapshot, ...]:
            self.snapshot_calls += 1
            return (snapshot("binary_sensor.door", "door"),)

    async def scenario() -> None:
        discovery = FakeDiscovery()
        await discovery.async_targets()
        await discovery.async_for_target("binary_sensor.door")
        assert discovery.snapshot_calls == 1
        discovery.invalidate()
        await discovery.async_targets()
        assert discovery.snapshot_calls == 2

    import asyncio

    asyncio.run(scenario())
