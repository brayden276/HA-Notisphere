"""Versioned persistence abstractions and the rule repository."""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from types import MappingProxyType
from typing import Protocol, cast

from .models import (
    STORAGE_SCHEMA_VERSION,
    ActivityRecord,
    FrozenJson,
    JsonValue,
    NotificationRule,
    RecipientGroup,
    RecipientProfile,
    _freeze_json,
    _thaw_json,
)
from .validation import require_valid_group, require_valid_recipient, require_valid_rule

DEFAULT_ACTIVITY_RETENTION_DAYS = 30
DEFAULT_ACTIVITY_RETENTION_RECORDS = 1_000
ACTIVITY_RETENTION_PREFERENCES_VERSION = 1
ACTIVITY_RETENTION_PREFERENCES_KEY = "activity_retention"
MIN_ACTIVITY_RETENTION_DAYS = 1
MAX_ACTIVITY_RETENTION_DAYS = 3_650
MIN_ACTIVITY_RETENTION_RECORDS = 1
MAX_ACTIVITY_RETENTION_RECORDS = 1_000


@dataclass(frozen=True, slots=True)
class ActivityRetentionSettings:
    """Validated activity limits persisted independently of the storage schema."""

    days: int = DEFAULT_ACTIVITY_RETENTION_DAYS
    records: int = DEFAULT_ACTIVITY_RETENTION_RECORDS
    schema_version: int = ACTIVITY_RETENTION_PREFERENCES_VERSION

    def __post_init__(self) -> None:
        _validate_retention_value(
            self.days,
            "days",
            MIN_ACTIVITY_RETENTION_DAYS,
            MAX_ACTIVITY_RETENTION_DAYS,
        )
        _validate_retention_value(
            self.records,
            "records",
            MIN_ACTIVITY_RETENTION_RECORDS,
            MAX_ACTIVITY_RETENTION_RECORDS,
        )
        if (
            not isinstance(self.schema_version, int)
            or isinstance(self.schema_version, bool)
            or self.schema_version != ACTIVITY_RETENTION_PREFERENCES_VERSION
        ):
            raise ValueError("Unsupported activity retention preferences version")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "schema_version": self.schema_version,
            "days": self.days,
            "records": self.records,
        }


def _validate_retention_value(value: int, name: str, minimum: int, maximum: int) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"Activity retention {name} must be an integer")
    if not minimum <= value <= maximum:
        raise ValueError(
            f"Activity retention {name} must be between {minimum} and {maximum}"
        )


@dataclass(frozen=True, slots=True)
class StorageSnapshot:
    """Complete schema-versioned operational state stored as one JSON object."""

    schema_version: int = STORAGE_SCHEMA_VERSION
    rules: tuple[NotificationRule, ...] = ()
    recipients: tuple[RecipientProfile, ...] = ()
    groups: tuple[RecipientGroup, ...] = ()
    activity: tuple[ActivityRecord, ...] = ()
    preferences: FrozenJson = field(default_factory=lambda: MappingProxyType({}))

    def __post_init__(self) -> None:
        object.__setattr__(self, "rules", tuple(self.rules))
        object.__setattr__(self, "recipients", tuple(self.recipients))
        object.__setattr__(self, "groups", tuple(self.groups))
        object.__setattr__(self, "activity", tuple(self.activity))
        object.__setattr__(self, "preferences", _freeze_json(self.preferences))

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "schema_version": self.schema_version,
            "rules": [rule.to_dict() for rule in self.rules],
            "recipients": [recipient.to_dict() for recipient in self.recipients],
            "groups": [group.to_dict() for group in self.groups],
            "activity": [record.to_dict() for record in self.activity],
            "preferences": _thaw_json(self.preferences),
        }

    @classmethod
    def from_dict(cls, raw: object) -> StorageSnapshot:
        if not isinstance(raw, dict):
            raise ValueError("Stored data must be an object")

        def array(name: str) -> list[object]:
            value = raw.get(name)
            if not isinstance(value, list):
                raise ValueError(f"{name} must be an array")
            return value

        schema_version = raw.get("schema_version")
        if not isinstance(schema_version, int) or isinstance(schema_version, bool):
            raise ValueError("schema_version must be an integer")
        preferences = raw.get("preferences")
        if not isinstance(preferences, dict):
            raise ValueError("preferences must be an object")
        return cls(
            schema_version=schema_version,
            rules=tuple(NotificationRule.from_dict(item) for item in array("rules")),
            recipients=tuple(RecipientProfile.from_dict(item) for item in array("recipients")),
            groups=tuple(RecipientGroup.from_dict(item) for item in array("groups")),
            activity=tuple(ActivityRecord.from_dict(item) for item in array("activity")),
            preferences=cast(FrozenJson, preferences),
        )


class StorageBackend(Protocol):
    """Adapter boundary for Home Assistant Store or another JSON backend."""

    async def load(self) -> Mapping[str, JsonValue] | None:
        """Load a fresh JSON-compatible mapping, or ``None`` when empty."""

    async def save(self, data: Mapping[str, JsonValue]) -> None:
        """Atomically replace persisted state with ``data``."""


class InMemoryStorageBackend:
    """Caller-safe backend for tests and embedding without Home Assistant."""

    def __init__(self, initial: Mapping[str, JsonValue] | None = None) -> None:
        self._data = _copy_mapping(initial) if initial is not None else None

    async def load(self) -> Mapping[str, JsonValue] | None:
        return _copy_mapping(self._data) if self._data is not None else None

    async def save(self, data: Mapping[str, JsonValue]) -> None:
        self._data = _copy_mapping(data)


def _copy_mapping(data: Mapping[str, JsonValue]) -> dict[str, JsonValue]:
    frozen = _freeze_json(dict(data))
    copied = _thaw_json(frozen)
    if not isinstance(copied, dict):  # pragma: no cover - guaranteed by input type
        raise TypeError("Expected an object")
    return copied


class RepositoryError(RuntimeError):
    """Base class for repository failures."""


class RuleNotFoundError(RepositoryError):
    def __init__(self, rule_id: str) -> None:
        self.rule_id = rule_id
        super().__init__(f"Rule {rule_id!r} does not exist")


class RevisionConflictError(RepositoryError):
    def __init__(
        self, rule_id: str, expected_revision: int | None, actual_revision: int | None
    ) -> None:
        self.rule_id = rule_id
        self.expected_revision = expected_revision
        self.actual_revision = actual_revision
        super().__init__(
            f"Revision conflict for {rule_id!r}: expected {expected_revision}, "
            f"actual {actual_revision}"
        )


class RuleRepository:
    """Concurrency-safe CRUD over an injected schema-versioned backend."""

    def __init__(
        self,
        backend: StorageBackend,
        *,
        clock: Callable[[], datetime] | None = None,
        activity_retention_days: int = DEFAULT_ACTIVITY_RETENTION_DAYS,
        activity_retention_records: int = DEFAULT_ACTIVITY_RETENTION_RECORDS,
    ) -> None:
        defaults = ActivityRetentionSettings(
            days=activity_retention_days,
            records=activity_retention_records,
        )
        self._backend = backend
        self._clock = clock or (lambda: datetime.now(UTC))
        self._retention_days = defaults.days
        self._retention_records = defaults.records
        self._snapshot: StorageSnapshot | None = None
        self._rules_by_id: dict[str, NotificationRule] = {}
        self._lock = asyncio.Lock()

    async def _ensure_loaded(self) -> StorageSnapshot:
        if self._snapshot is None:
            raw = await self._backend.load()
            if raw is None:
                self._snapshot = StorageSnapshot()
            else:
                from .migrations import migrate_storage

                self._snapshot = migrate_storage(dict(raw))
            settings = self._retention_settings_from_preferences(self._snapshot.preferences)
            self._retention_days = settings.days
            self._retention_records = settings.records
            retained_activity = self._retain_activity(self._snapshot.activity)
            if retained_activity != self._snapshot.activity:
                self._snapshot = replace(self._snapshot, activity=retained_activity)
            self._rules_by_id = {rule.id: rule for rule in self._snapshot.rules}
        return self._snapshot

    async def snapshot(self) -> StorageSnapshot:
        """Return the immutable in-memory snapshot without serialising a copy."""

        async with self._lock:
            return await self._ensure_loaded()

    async def list(self) -> tuple[NotificationRule, ...]:
        async with self._lock:
            snapshot = await self._ensure_loaded()
            return tuple(sorted(snapshot.rules, key=lambda rule: (rule.name.casefold(), rule.id)))

    async def get(self, rule_id: str) -> NotificationRule | None:
        async with self._lock:
            await self._ensure_loaded()
            return self._rules_by_id.get(rule_id)

    async def create(self, rule: NotificationRule) -> NotificationRule:
        async with self._lock:
            snapshot = await self._ensure_loaded()
            if (existing := self._rules_by_id.get(rule.id)) is not None:
                raise RevisionConflictError(rule.id, None, existing.revision)
            now = self._now()
            created = replace(rule, revision=1, created_at=now, updated_at=now)
            require_valid_rule(created)
            await self._persist(replace(snapshot, rules=(*snapshot.rules, created)))
            return created

    async def update(self, rule: NotificationRule, *, expected_revision: int) -> NotificationRule:
        async with self._lock:
            snapshot = await self._ensure_loaded()
            existing = self._rules_by_id.get(rule.id)
            if existing is None:
                raise RuleNotFoundError(rule.id)
            if existing.revision != expected_revision:
                raise RevisionConflictError(rule.id, expected_revision, existing.revision)
            updated = replace(
                rule,
                revision=existing.revision + 1,
                created_at=existing.created_at,
                updated_at=self._now(),
            )
            require_valid_rule(updated)
            rules = tuple(updated if item.id == rule.id else item for item in snapshot.rules)
            await self._persist(replace(snapshot, rules=rules))
            return updated

    async def save(
        self,
        rule: NotificationRule,
        *,
        expected_revision: int | None = None,
    ) -> NotificationRule:
        """Create a missing rule, or update an existing rule with a revision guard."""

        async with self._lock:
            snapshot = await self._ensure_loaded()
            existing = self._rules_by_id.get(rule.id)
            if existing is None:
                if expected_revision is not None:
                    raise RevisionConflictError(rule.id, expected_revision, None)
                now = self._now()
                saved = replace(rule, revision=1, created_at=now, updated_at=now)
                require_valid_rule(saved)
                await self._persist(replace(snapshot, rules=(*snapshot.rules, saved)))
                return saved
            if expected_revision != existing.revision:
                raise RevisionConflictError(rule.id, expected_revision, existing.revision)
            saved = replace(
                rule,
                revision=existing.revision + 1,
                created_at=existing.created_at,
                updated_at=self._now(),
            )
            require_valid_rule(saved)
            rules = tuple(saved if item.id == rule.id else item for item in snapshot.rules)
            await self._persist(replace(snapshot, rules=rules))
            return saved

    async def delete(self, rule_id: str, *, expected_revision: int) -> None:
        async with self._lock:
            snapshot = await self._ensure_loaded()
            existing = self._rules_by_id.get(rule_id)
            if existing is None:
                raise RuleNotFoundError(rule_id)
            if existing.revision != expected_revision:
                raise RevisionConflictError(rule_id, expected_revision, existing.revision)
            await self._persist(
                replace(
                    snapshot, rules=tuple(item for item in snapshot.rules if item.id != rule_id)
                )
            )

    async def append_activity(self, record: ActivityRecord) -> None:
        async with self._lock:
            snapshot = await self._ensure_loaded()
            newest_first = (
                not snapshot.activity or record.timestamp >= snapshot.activity[0].timestamp
            )
            records = (
                (record, *snapshot.activity)
                if newest_first
                else (*snapshot.activity, record)
            )
            retained = self._retain_activity(records, newest_first=newest_first)
            await self._persist(replace(snapshot, activity=retained), delayed=True)

    async def list_activity(self) -> tuple[ActivityRecord, ...]:
        async with self._lock:
            snapshot = await self._ensure_loaded()
            return self._retain_activity(snapshot.activity, newest_first=True)

    async def activity_retention_settings(self) -> ActivityRetentionSettings:
        """Return the active limits after applying persisted safe preferences."""

        async with self._lock:
            await self._ensure_loaded()
            return ActivityRetentionSettings(
                days=self._retention_days,
                records=self._retention_records,
            )

    async def update_activity_retention(
        self,
        *,
        days: int,
        records: int,
    ) -> ActivityRetentionSettings:
        """Persist validated limits and immediately prune retained activity."""

        settings = ActivityRetentionSettings(days=days, records=records)
        async with self._lock:
            snapshot = await self._ensure_loaded()
            preferences = _thaw_json(snapshot.preferences)
            if not isinstance(preferences, dict):  # pragma: no cover - snapshot invariant
                preferences = {}
            preferences[ACTIVITY_RETENTION_PREFERENCES_KEY] = settings.to_dict()
            retained = self._retain_activity(
                snapshot.activity,
                days=settings.days,
                record_limit=settings.records,
                newest_first=True,
            )
            await self._persist(
                replace(
                    snapshot,
                    activity=retained,
                    preferences=cast(FrozenJson, preferences),
                )
            )
            self._retention_days = settings.days
            self._retention_records = settings.records
            return settings

    async def replace_recipients(self, recipients: tuple[RecipientProfile, ...]) -> None:
        """Persist a complete discovery result for a later recipient service."""

        for recipient in recipients:
            require_valid_recipient(recipient)
        async with self._lock:
            snapshot = await self._ensure_loaded()
            recipients = tuple(recipients)
            if snapshot.recipients == recipients:
                return
            await self._persist(replace(snapshot, recipients=recipients))

    async def replace_groups(self, groups: tuple[RecipientGroup, ...]) -> None:
        """Persist groups while their Phase 3 CRUD service remains separate."""

        for group in groups:
            require_valid_group(group)
        async with self._lock:
            snapshot = await self._ensure_loaded()
            groups = tuple(groups)
            if snapshot.groups == groups:
                return
            await self._persist(replace(snapshot, groups=groups))

    def _retain_activity(
        self,
        records: tuple[ActivityRecord, ...],
        *,
        days: int | None = None,
        record_limit: int | None = None,
        newest_first: bool = False,
    ) -> tuple[ActivityRecord, ...]:
        cutoff = self._now() - timedelta(days=days or self._retention_days)
        recent = tuple(record for record in records if record.timestamp >= cutoff)
        ordered = (
            recent
            if newest_first
            else tuple(sorted(recent, key=lambda record: record.timestamp, reverse=True))
        )
        return tuple(ordered[: record_limit or self._retention_records])

    def _retention_settings_from_preferences(
        self, preferences: FrozenJson
    ) -> ActivityRetentionSettings:
        """Decode the independent preference schema, falling back on bad data."""

        fallback = ActivityRetentionSettings(
            days=self._retention_days,
            records=self._retention_records,
        )
        if not isinstance(preferences, Mapping):
            return fallback
        raw = preferences.get(ACTIVITY_RETENTION_PREFERENCES_KEY)
        if not isinstance(raw, Mapping):
            return fallback
        version = raw.get("schema_version")
        days = raw.get("days")
        records = raw.get("records")
        if (
            not isinstance(version, int)
            or isinstance(version, bool)
            or version != ACTIVITY_RETENTION_PREFERENCES_VERSION
        ):
            return fallback
        try:
            return ActivityRetentionSettings(
                days=cast(int, days),
                records=cast(int, records),
                schema_version=cast(int, version),
            )
        except ValueError:
            return fallback

    def _now(self) -> datetime:
        value = self._clock()
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Repository clock must return a timezone-aware datetime")
        return value.astimezone(UTC)

    async def _persist(
        self, snapshot: StorageSnapshot, *, delayed: bool = False
    ) -> None:
        rules_changed = self._snapshot is None or snapshot.rules is not self._snapshot.rules
        delayed_snapshot_save = getattr(self._backend, "save_snapshot_delayed", None)
        if delayed and callable(delayed_snapshot_save):
            delayed_snapshot_save(snapshot)
            self._snapshot = snapshot
            if rules_changed:
                self._rules_by_id = {rule.id: rule for rule in snapshot.rules}
            return
        data = snapshot.to_dict()
        delayed_save = getattr(self._backend, "save_delayed", None)
        if delayed and callable(delayed_save):
            delayed_save(data)
        else:
            await self._backend.save(data)
        self._snapshot = snapshot
        if rules_changed:
            self._rules_by_id = {rule.id: rule for rule in snapshot.rules}


__all__ = [
    "ACTIVITY_RETENTION_PREFERENCES_KEY",
    "ACTIVITY_RETENTION_PREFERENCES_VERSION",
    "DEFAULT_ACTIVITY_RETENTION_DAYS",
    "DEFAULT_ACTIVITY_RETENTION_RECORDS",
    "ActivityRetentionSettings",
    "InMemoryStorageBackend",
    "RepositoryError",
    "RevisionConflictError",
    "RuleNotFoundError",
    "RuleRepository",
    "StorageBackend",
    "StorageSnapshot",
]
