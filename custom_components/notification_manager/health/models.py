"""Home Assistant-independent inputs and outputs for rule health reconciliation."""

from __future__ import annotations

from dataclasses import dataclass

from ..models import NotificationRule, RecipientGroup, RecipientProfile


@dataclass(frozen=True, slots=True)
class HealthEntitySnapshot:
    """The small part of an entity-registry/state snapshot needed by health checks."""

    entity_id: str
    registry_id: str | None
    available: bool


@dataclass(frozen=True, slots=True)
class HealthUserSnapshot:
    """Directory identity used to expand owner and administrator audiences."""

    id: str
    is_admin: bool = False


@dataclass(frozen=True, slots=True)
class RuleHealthSnapshot:
    """Immutable current-world view consumed by the pure reconciler."""

    entities: tuple[HealthEntitySnapshot, ...]
    recipients: tuple[RecipientProfile, ...]
    groups: tuple[RecipientGroup, ...]
    directory_users: tuple[HealthUserSnapshot, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "entities", tuple(self.entities))
        object.__setattr__(self, "recipients", tuple(self.recipients))
        object.__setattr__(self, "groups", tuple(self.groups))
        object.__setattr__(self, "directory_users", tuple(self.directory_users))


@dataclass(frozen=True, slots=True)
class HealthReconciliationReport:
    """Persisted results plus safe outcomes for concurrent deletion or churn."""

    updated_rules: tuple[NotificationRule, ...] = ()
    unchanged_rule_ids: tuple[str, ...] = ()
    conflicted_rule_ids: tuple[str, ...] = ()
    deleted_rule_ids: tuple[str, ...] = ()


__all__ = [
    "HealthEntitySnapshot",
    "HealthReconciliationReport",
    "HealthUserSnapshot",
    "RuleHealthSnapshot",
]
