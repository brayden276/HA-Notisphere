"""Thin Home Assistant snapshot adapter for the pure capability registry."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .models import CapabilityTarget, ResolvedTrigger, Semantic, TargetSnapshot
from .registry import CapabilityRegistry

_DISCOVERY_DOMAINS = frozenset({"binary_sensor", "person", "sensor"})


class HomeAssistantCapabilityDiscovery:
    """Cache HA registry/state snapshots until explicitly invalidated."""

    def __init__(self, hass: Any) -> None:
        self._hass = hass
        self._registry: CapabilityRegistry | None = None

    def invalidate(self) -> None:
        """Discard cached discovery after an entity/device registry change."""

        self._registry = None

    async def async_targets(self) -> tuple[CapabilityTarget, ...]:
        return (await self._async_registry()).targets()

    async def async_for_target(self, entity_id: str) -> CapabilityTarget:
        return (await self._async_registry()).for_target(entity_id)

    async def async_resolve(
        self,
        entity_id: str,
        semantic: Semantic | str,
        parameters: Mapping[str, object] | None = None,
    ) -> ResolvedTrigger:
        return (await self._async_registry()).resolve(entity_id, semantic, parameters)

    async def _async_registry(self) -> CapabilityRegistry:
        if self._registry is None:
            self._registry = CapabilityRegistry(self._snapshots())
        return self._registry

    def _snapshots(self) -> tuple[TargetSnapshot, ...]:
        from homeassistant.const import (
            ATTR_DEVICE_CLASS,
            ATTR_FRIENDLY_NAME,
            ATTR_UNIT_OF_MEASUREMENT,
            STATE_UNAVAILABLE,
            STATE_UNKNOWN,
        )
        from homeassistant.helpers import device_registry as dr
        from homeassistant.helpers import entity_registry as er

        entity_registry = er.async_get(self._hass)
        device_registry = dr.async_get(self._hass)
        entity_ids = {
            entry.entity_id
            for entry in entity_registry.entities.values()
            if entry.entity_id.partition(".")[0] in _DISCOVERY_DOMAINS
        }
        entity_ids.update(
            state.entity_id
            for domain in _DISCOVERY_DOMAINS
            for state in self._hass.states.async_all(domain)
        )
        snapshots = []
        for entity_id in sorted(entity_ids):
            domain = entity_id.partition(".")[0]
            state = self._hass.states.get(entity_id)
            entry = entity_registry.async_get(entity_id)
            attributes = state.attributes if state is not None else {}
            device_id = getattr(entry, "device_id", None)
            device = device_registry.async_get(device_id) if device_id else None
            display_name = _first_string(
                attributes.get(ATTR_FRIENDLY_NAME),
                getattr(entry, "name", None),
                getattr(entry, "original_name", None),
                getattr(state, "name", None),
                entity_id,
            )
            snapshots.append(
                TargetSnapshot(
                    entity_id=entity_id,
                    domain=domain,
                    display_name=display_name,
                    device_class=_first_optional_string(
                        attributes.get(ATTR_DEVICE_CLASS),
                        getattr(entry, "device_class", None),
                        getattr(entry, "original_device_class", None),
                    ),
                    available=state is not None
                    and state.state not in {STATE_UNAVAILABLE, STATE_UNKNOWN},
                    registry_id=getattr(entry, "id", None),
                    device_id=device_id,
                    unit=_first_optional_string(attributes.get(ATTR_UNIT_OF_MEASUREMENT)),
                    device_name=_first_optional_string(
                        getattr(device, "name_by_user", None),
                        getattr(device, "name", None),
                    ),
                )
            )
        return tuple(snapshots)


def _first_optional_string(*values: object) -> str | None:
    return next((value for value in values if isinstance(value, str) and value), None)


def _first_string(*values: object) -> str:
    value = _first_optional_string(*values)
    if value is None:
        raise ValueError("At least one display name must be supplied")
    return value


__all__ = ["HomeAssistantCapabilityDiscovery"]
