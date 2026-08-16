"""Permission-aware activity, diagnostics and operational settings services."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Protocol

from .manager import PermissionDeniedError, RequestUser
from .models import (
    ActivityRecord,
    ActivityStatus,
    RuleHealthStatus,
    RuleScope,
)
from .storage import ActivityRetentionSettings, RuleRepository


class WatcherStatus(Protocol):
    """Non-sensitive watcher counters exposed by the runtime registry."""

    @property
    def entity_ids(self) -> tuple[str, ...]: ...

    @property
    def rule_ids(self) -> tuple[str, ...]: ...


class TimerStatus(Protocol):
    """Non-sensitive pending timer counters exposed by the runtime timer manager."""

    @property
    def pending_rule_ids(self) -> tuple[str, ...]: ...


class RuntimeStatusProvider(Protocol):
    """Small structural boundary implemented by the existing runtime manager."""

    @property
    def watchers(self) -> WatcherStatus: ...

    @property
    def timers(self) -> TimerStatus: ...


@dataclass(frozen=True, slots=True)
class RuntimeDiagnostics:
    attached: bool
    watched_rules: int
    watched_entities: int
    pending_timers: int

    def to_dict(self) -> dict[str, bool | int]:
        return {
            "attached": self.attached,
            "watched_rules": self.watched_rules,
            "watched_entities": self.watched_entities,
            "pending_timers": self.pending_timers,
        }


@dataclass(frozen=True, slots=True)
class DiagnosticsSnapshot:
    """Aggregate diagnostics that deliberately omit notification payloads and targets."""

    version: str
    rule_count: int
    enabled_rule_count: int
    rule_health_counts: dict[str, int]
    recipient_count: int
    endpoint_count: int
    enabled_endpoint_count: int
    activity_record_count: int
    activity_retention: ActivityRetentionSettings
    runtime: RuntimeDiagnostics

    def to_dict(self) -> dict[str, object]:
        return {
            "version": self.version,
            "rules": {
                "total": self.rule_count,
                "enabled": self.enabled_rule_count,
                "health": dict(self.rule_health_counts),
            },
            "discovery": {
                "recipients": self.recipient_count,
                "endpoints": self.endpoint_count,
                "enabled_endpoints": self.enabled_endpoint_count,
            },
            "activity": {
                "records": self.activity_record_count,
                "retention": self.activity_retention.to_dict(),
            },
            "runtime": self.runtime.to_dict(),
        }


class ObservabilityService:
    """Answer operational questions without leaking inaccessible rules or payloads."""

    def __init__(
        self,
        repository: RuleRepository,
        *,
        version: str,
        runtime: RuntimeStatusProvider | None = None,
    ) -> None:
        if not version.strip():
            raise ValueError("Integration version must not be empty")
        self._repository = repository
        self._version = version
        self._runtime = runtime

    async def list_activity(
        self,
        user: RequestUser,
        *,
        rule_id: str | None = None,
        recipient_id: str | None = None,
        status: ActivityStatus | None = None,
    ) -> tuple[ActivityRecord, ...]:
        """List newest-first activity constrained to the caller's visible rules."""

        visible_rule_ids = {
            rule.id
            for rule in await self._repository.list()
            if user.is_admin
            or (rule.scope is RuleScope.PERSONAL and rule.owner_user_id == user.id)
        }
        records = await self._repository.list_activity()
        return tuple(
            record
            for record in records
            if record.rule_id in visible_rule_ids
            and (rule_id is None or record.rule_id == rule_id)
            and (status is None or record.status is status)
            and (
                recipient_id is None
                or any(
                    result.recipient_id == recipient_id
                    for result in record.recipient_results
                )
            )
        )

    async def get_settings(self, user: RequestUser) -> ActivityRetentionSettings:
        self._require_admin(user)
        return await self._repository.activity_retention_settings()

    async def update_settings(
        self,
        user: RequestUser,
        *,
        activity_retention_days: int,
        activity_retention_records: int,
    ) -> ActivityRetentionSettings:
        self._require_admin(user)
        return await self._repository.update_activity_retention(
            days=activity_retention_days,
            records=activity_retention_records,
        )

    async def diagnostics(self, user: RequestUser) -> DiagnosticsSnapshot:
        self._require_admin(user)
        snapshot = await self._repository.snapshot()
        retained_activity = await self._repository.list_activity()
        settings = await self._repository.activity_retention_settings()
        health_counts = Counter(rule.health.status.value for rule in snapshot.rules)
        runtime = self._runtime_diagnostics()
        endpoints = tuple(
            endpoint for recipient in snapshot.recipients for endpoint in recipient.endpoints
        )
        return DiagnosticsSnapshot(
            version=self._version,
            rule_count=len(snapshot.rules),
            enabled_rule_count=sum(rule.enabled for rule in snapshot.rules),
            rule_health_counts={
                health.value: health_counts.get(health.value, 0)
                for health in RuleHealthStatus
            },
            recipient_count=len(snapshot.recipients),
            endpoint_count=len(endpoints),
            enabled_endpoint_count=sum(endpoint.enabled for endpoint in endpoints),
            activity_record_count=len(retained_activity),
            activity_retention=settings,
            runtime=runtime,
        )

    def _runtime_diagnostics(self) -> RuntimeDiagnostics:
        if self._runtime is None:
            return RuntimeDiagnostics(False, 0, 0, 0)
        return RuntimeDiagnostics(
            attached=True,
            watched_rules=len(self._runtime.watchers.rule_ids),
            watched_entities=len(self._runtime.watchers.entity_ids),
            pending_timers=len(self._runtime.timers.pending_rule_ids),
        )

    @staticmethod
    def _require_admin(user: RequestUser) -> None:
        if not user.is_admin:
            raise PermissionDeniedError(
                "Only an administrator can access notification settings and diagnostics."
            )


__all__ = [
    "DiagnosticsSnapshot",
    "ObservabilityService",
    "RuntimeDiagnostics",
    "RuntimeStatusProvider",
    "TimerStatus",
    "WatcherStatus",
]
