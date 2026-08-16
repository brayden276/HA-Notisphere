"""Indexed rule watchers sharing one entity-to-rule lookup."""

from __future__ import annotations

from ..models import NotificationRule, TriggerType

_STATE_TRIGGER_TYPES = frozenset(
    {TriggerType.BINARY_STATE, TriggerType.BINARY_STATE_DURATION}
)


class WatcherRegistry:
    """Maintain an O(1) entity index for enabled state-driven rules."""

    def __init__(self) -> None:
        self._rule_ids_by_entity: dict[str, set[str]] = {}
        self._entity_by_rule_id: dict[str, str] = {}

    def rebuild(self, rules: tuple[NotificationRule, ...]) -> None:
        self.clear()
        for rule in rules:
            self.upsert(rule)

    def upsert(self, rule: NotificationRule) -> None:
        self.remove(rule.id)
        target = rule.trigger.target
        if not rule.enabled or rule.trigger.type not in _STATE_TRIGGER_TYPES or target is None:
            return
        self._entity_by_rule_id[rule.id] = target.entity_id
        self._rule_ids_by_entity.setdefault(target.entity_id, set()).add(rule.id)

    def remove(self, rule_id: str) -> None:
        entity_id = self._entity_by_rule_id.pop(rule_id, None)
        if entity_id is None:
            return
        rule_ids = self._rule_ids_by_entity[entity_id]
        rule_ids.discard(rule_id)
        if not rule_ids:
            self._rule_ids_by_entity.pop(entity_id, None)

    def clear(self) -> None:
        self._rule_ids_by_entity.clear()
        self._entity_by_rule_id.clear()

    def rule_ids_for(self, entity_id: str) -> tuple[str, ...]:
        return tuple(sorted(self._rule_ids_by_entity.get(entity_id, ())))

    @property
    def entity_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._rule_ids_by_entity))

    @property
    def rule_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._entity_by_rule_id))


__all__ = ["WatcherRegistry"]
