"""Thin Home Assistant registry/state adapter for explicit health reconciliation."""

from __future__ import annotations

from typing import Any

from ..models import RecipientGroup, RecipientProfile
from .models import (
    HealthEntitySnapshot,
    HealthReconciliationReport,
    HealthUserSnapshot,
    RuleHealthSnapshot,
)
from .service import RuleHealthReconciliationService


class HomeAssistantRuleHealthAdapter:
    """Cache a registry/state view until an integration event explicitly invalidates it."""

    def __init__(self, hass: Any) -> None:
        self._hass = hass
        self._entities: tuple[HealthEntitySnapshot, ...] | None = None

    def invalidate(self) -> None:
        """Discard the cached view after a registry or relevant state change."""

        self._entities = None

    async def async_snapshot(
        self,
        recipients: tuple[RecipientProfile, ...],
        groups: tuple[RecipientGroup, ...],
        directory_users: tuple[HealthUserSnapshot, ...],
    ) -> RuleHealthSnapshot:
        if self._entities is None:
            self._entities = self._snapshots()
        return RuleHealthSnapshot(self._entities, recipients, groups, directory_users)

    async def async_reconcile(
        self,
        service: RuleHealthReconciliationService,
        recipients: tuple[RecipientProfile, ...],
        groups: tuple[RecipientGroup, ...],
        directory_users: tuple[HealthUserSnapshot, ...],
    ) -> HealthReconciliationReport:
        """Refresh and reconcile once; callers decide which HA events invoke this."""

        self.invalidate()
        snapshot = await self.async_snapshot(recipients, groups, directory_users)
        return await service.async_reconcile(snapshot)

    def _snapshots(self) -> tuple[HealthEntitySnapshot, ...]:
        from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
        from homeassistant.helpers import entity_registry as er

        entity_registry = er.async_get(self._hass)
        entries_by_entity_id = {
            entry.entity_id: entry for entry in entity_registry.entities.values()
        }
        entity_ids = set(entries_by_entity_id)
        entity_ids.update(state.entity_id for state in self._hass.states.async_all())

        snapshots = []
        for entity_id in sorted(entity_ids):
            entry = entries_by_entity_id.get(entity_id)
            state = self._hass.states.get(entity_id)
            snapshots.append(
                HealthEntitySnapshot(
                    entity_id=entity_id,
                    registry_id=getattr(entry, "id", None),
                    available=state is not None
                    and state.state not in {STATE_UNAVAILABLE, STATE_UNKNOWN},
                )
            )
        return tuple(snapshots)


__all__ = ["HomeAssistantRuleHealthAdapter"]
