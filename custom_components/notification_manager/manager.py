"""Application service and permission boundary for Notification Manager."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Protocol

from .models import ActivityRecord, NotificationRule, RuleScope
from .recipients.delivery import NotificationDelivery
from .recipients.manager import RecipientManager
from .storage import RevisionConflictError, RuleNotFoundError, RuleRepository


@dataclass(frozen=True, slots=True)
class RequestUser:
    """The authenticated identity required by the application service."""

    id: str
    is_admin: bool
    name: str = ""


class PermissionDeniedError(PermissionError):
    """The authenticated user cannot perform an operation."""

    code = "permission_denied"


class RuntimeController(Protocol):
    """Runtime lifecycle boundary kept separate from the application service."""

    async def async_start(self) -> None: ...

    async def async_stop(self) -> None: ...

    async def async_upsert_rule(self, rule: NotificationRule) -> None: ...

    async def async_remove_rule(self, rule_id: str) -> None: ...

    async def async_test_rule(self, rule: NotificationRule) -> ActivityRecord: ...


class HealthController(Protocol):
    """Environmental rule-health lifecycle boundary."""

    async def async_start(self) -> None: ...

    async def async_stop(self) -> None: ...

    async def async_reconcile(self) -> object: ...


class RuntimeUnavailableError(RuntimeError):
    """The integration has no active delivery runtime."""

    code = "runtime_unavailable"


class NotificationManager:
    """Coordinate canonical state independently of transport details."""

    def __init__(
        self,
        repository: RuleRepository,
        recipient_delivery: NotificationDelivery | None = None,
        capability_discovery: Any | None = None,
    ) -> None:
        self.repository = repository
        self.recipients = RecipientManager(repository)
        self.recipient_delivery = recipient_delivery
        self.capability_discovery = capability_discovery
        self.discovery_issues: tuple[dict[str, object], ...] = ()
        self.runtime: RuntimeController | None = None
        self.health: HealthController | None = None
        self.observability: Any | None = None

    def set_runtime(self, runtime: RuntimeController) -> None:
        """Attach the runtime before startup without creating an import cycle."""

        self.runtime = runtime

    def set_health(self, health: HealthController) -> None:
        """Attach automatic health reconciliation before startup."""

        self.health = health

    async def async_start(self) -> None:
        """Load and validate persisted state before accepting requests."""

        await self.repository.snapshot()
        if self.runtime is not None:
            await self.runtime.async_start()
        if self.health is not None:
            await self.health.async_start()

    async def async_stop(self) -> None:
        """Stop active listeners and timers."""

        if self.health is not None:
            await self.health.async_stop()
        if self.runtime is not None:
            await self.runtime.async_stop()

    async def bootstrap(self, user: RequestUser) -> dict[str, Any]:
        snapshot = await self.repository.snapshot()
        rules = tuple(rule for rule in snapshot.rules if self._can_read(rule, user))
        groups = await self.recipients.list_groups()
        capability_targets = (
            await self.capability_discovery.async_targets()
            if self.capability_discovery is not None
            else ()
        )
        return {
            "current_user": {"id": user.id, "name": user.name, "is_admin": user.is_admin},
            "rules": [rule.to_dict() for rule in rules],
            "recipients": [item.to_dict() for item in snapshot.recipients],
            "groups": [item.to_dict() for item in groups],
            "unconfirmed_recipient_mappings": list(self.discovery_issues),
            "capability_targets": [item.to_dict() for item in capability_targets],
            "activity": [
                item.to_dict()
                for item in snapshot.activity
                if any(rule.id == item.rule_id for rule in rules)
            ],
        }

    def set_discovery_issues(self, issues: tuple[dict[str, object], ...]) -> None:
        """Expose conservative discovery results to onboarding until next refresh."""

        self.discovery_issues = tuple(dict(issue) for issue in issues)

    async def list_rules(self, user: RequestUser) -> tuple[NotificationRule, ...]:
        return tuple(rule for rule in await self.repository.list() if self._can_read(rule, user))

    async def get_rule(self, rule_id: str, user: RequestUser) -> NotificationRule:
        rule = await self.repository.get(rule_id)
        if rule is None:
            raise RuleNotFoundError(rule_id)
        if not self._can_read(rule, user):
            raise PermissionDeniedError("You cannot view this notification.")
        return rule

    async def create_rule(self, rule: NotificationRule, user: RequestUser) -> NotificationRule:
        rule = replace(rule, owner_user_id=user.id)
        self._require_write(rule, user)
        saved = await self.repository.create(rule)
        if self.runtime is not None:
            await self.runtime.async_upsert_rule(saved)
        return await self._reconcile_saved_rule(saved)

    async def update_rule(
        self, rule: NotificationRule, expected_revision: int, user: RequestUser
    ) -> NotificationRule:
        current = await self.get_rule(rule.id, user)
        self._require_write(current, user)
        safe_rule = replace(rule, owner_user_id=current.owner_user_id, scope=current.scope)
        saved = await self.repository.update(
            safe_rule, expected_revision=expected_revision
        )
        if self.runtime is not None:
            await self.runtime.async_upsert_rule(saved)
        return await self._reconcile_saved_rule(saved)

    async def delete_rule(
        self, rule_id: str, expected_revision: int, user: RequestUser
    ) -> None:
        current = await self.get_rule(rule_id, user)
        self._require_write(current, user)
        await self.repository.delete(rule_id, expected_revision=expected_revision)
        if self.runtime is not None:
            await self.runtime.async_remove_rule(rule_id)

    async def set_rule_enabled(
        self, rule_id: str, enabled: bool, expected_revision: int, user: RequestUser
    ) -> NotificationRule:
        current = await self.get_rule(rule_id, user)
        self._require_write(current, user)
        saved = await self.repository.update(
            replace(current, enabled=enabled), expected_revision=expected_revision
        )
        if self.runtime is not None:
            await self.runtime.async_upsert_rule(saved)
        return await self._reconcile_saved_rule(saved)

    async def test_rule(self, rule_id: str, user: RequestUser) -> ActivityRecord:
        """Send a rule's current message without waiting for its trigger or conditions."""

        rule = await self.get_rule(rule_id, user)
        if self.runtime is None:
            raise RuntimeUnavailableError("Notification delivery is unavailable.")
        return await self.runtime.async_test_rule(rule)

    async def async_reconcile_health(self) -> None:
        """Refresh health after recipient/group or other explicit changes."""

        if self.health is not None:
            await self.health.async_reconcile()

    async def _reconcile_saved_rule(
        self, saved: NotificationRule
    ) -> NotificationRule:
        if self.health is None:
            return saved
        await self.health.async_reconcile()
        return await self.repository.get(saved.id) or saved

    @staticmethod
    def _can_read(rule: NotificationRule, user: RequestUser) -> bool:
        return user.is_admin or (
            rule.scope is RuleScope.PERSONAL and rule.owner_user_id == user.id
        )

    @staticmethod
    def _require_write(rule: NotificationRule, user: RequestUser) -> None:
        if rule.scope is RuleScope.HOUSEHOLD:
            if not user.is_admin:
                raise PermissionDeniedError(
                    "Only an administrator can change household notifications."
                )
            return
        if rule.owner_user_id != user.id and not user.is_admin:
            raise PermissionDeniedError("You can only change your own notifications.")


__all__ = [
    "HealthController",
    "NotificationManager",
    "PermissionDeniedError",
    "RequestUser",
    "RevisionConflictError",
    "RuleNotFoundError",
    "RuntimeController",
    "RuntimeUnavailableError",
]
