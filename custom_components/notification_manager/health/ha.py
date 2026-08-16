"""Thin Home Assistant registry/state adapter for explicit health reconciliation."""

from __future__ import annotations

from typing import Any

from ..models import NotificationRule, RecipientGroup, RecipientProfile, TargetRef
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
        rules: tuple[NotificationRule, ...] = (),
    ) -> RuleHealthSnapshot:
        if self._entities is None:
            self._entities = self._snapshots(_targets_for_rules(rules))
        return RuleHealthSnapshot(self._entities, recipients, groups, directory_users)

    async def async_reconcile(
        self,
        service: RuleHealthReconciliationService,
        recipients: tuple[RecipientProfile, ...],
        groups: tuple[RecipientGroup, ...],
        directory_users: tuple[HealthUserSnapshot, ...],
        rules: tuple[NotificationRule, ...] = (),
    ) -> HealthReconciliationReport:
        """Refresh and reconcile once; callers decide which HA events invoke this."""

        self.invalidate()
        snapshot = await self.async_snapshot(
            recipients, groups, directory_users, rules
        )
        return await service.async_reconcile(snapshot)

    def _snapshots(
        self, targets: tuple[TargetRef, ...]
    ) -> tuple[HealthEntitySnapshot, ...]:
        from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
        from homeassistant.helpers import entity_registry as er

        entity_registry = er.async_get(self._hass)
        entries_by_entity_id: dict[str, Any] = {}
        unresolved_registry_ids: set[str] = set()
        for target in targets:
            entry = entity_registry.async_get(target.entity_id)
            if target.registry_id is None:
                entries_by_entity_id[target.entity_id] = entry
            elif entry is not None and entry.id == target.registry_id:
                entries_by_entity_id[entry.entity_id] = entry
            else:
                unresolved_registry_ids.add(target.registry_id)
        if unresolved_registry_ids:
            for entry in entity_registry.entities.values():
                if entry.id in unresolved_registry_ids:
                    entries_by_entity_id[entry.entity_id] = entry

        snapshots = []
        for entity_id, entry in sorted(entries_by_entity_id.items()):
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


def _targets_for_rules(rules: tuple[NotificationRule, ...]) -> tuple[TargetRef, ...]:
    targets = {
        (target.entity_id, target.registry_id): target
        for rule in rules
        for target in (
            rule.trigger.target,
            *(condition.target for condition in rule.conditions),
        )
        if target is not None
    }
    return tuple(targets.values())


__all__ = ["HomeAssistantRuleHealthAdapter"]
