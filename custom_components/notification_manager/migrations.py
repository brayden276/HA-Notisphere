"""Storage migration registry and strict persisted-data loader."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import TypeAlias

from .models import STORAGE_SCHEMA_VERSION, JsonValue
from .storage import StorageSnapshot
from .validation import (
    DomainValidationError,
    require_valid_group,
    require_valid_recipient,
    require_valid_rule,
)

Migration: TypeAlias = Callable[[dict[str, JsonValue]], dict[str, JsonValue]]
MIGRATIONS: dict[int, Migration] = {}


class StorageMigrationError(ValueError):
    """Base class for persisted schema errors."""


class MalformedStorageError(StorageMigrationError):
    """Stored content does not satisfy its declared schema."""


class FutureStorageVersionError(StorageMigrationError):
    """Stored content was written by a newer integration version."""

    def __init__(self, stored_version: int, current_version: int) -> None:
        self.stored_version = stored_version
        self.current_version = current_version
        super().__init__(
            f"Storage schema {stored_version} is newer than supported schema {current_version}"
        )


class MissingStorageMigrationError(StorageMigrationError):
    """No migration is registered for an older storage version."""


def register_migration(source_version: int, migration: Migration) -> None:
    """Register the single-step migration from ``source_version`` to the next version."""

    if source_version < 1:
        raise ValueError("Source version must be positive")
    if source_version in MIGRATIONS:
        raise ValueError(f"Migration from schema {source_version} is already registered")
    MIGRATIONS[source_version] = migration


def migrate_storage(raw: object) -> StorageSnapshot:
    """Migrate and decode persisted JSON into the current immutable snapshot."""

    if not isinstance(raw, dict):
        raise MalformedStorageError("Stored data must be an object")
    data: dict[str, JsonValue] = dict(raw)
    version = data.get("schema_version")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise MalformedStorageError("schema_version must be a positive integer")
    if version > STORAGE_SCHEMA_VERSION:
        raise FutureStorageVersionError(version, STORAGE_SCHEMA_VERSION)

    while version < STORAGE_SCHEMA_VERSION:
        migration = MIGRATIONS.get(version)
        if migration is None:
            raise MissingStorageMigrationError(f"No migration registered from schema {version}")
        try:
            data = migration(data)
        except (TypeError, ValueError, KeyError) as err:
            raise MalformedStorageError(f"Migration from schema {version} failed: {err}") from err
        next_version = data.get("schema_version")
        if (
            not isinstance(next_version, int)
            or isinstance(next_version, bool)
            or next_version != version + 1
        ):
            raise MalformedStorageError(
                f"Migration from schema {version} must produce schema {version + 1}"
            )
        version = next_version

    try:
        snapshot = StorageSnapshot.from_dict(data)
        _validate_snapshot(snapshot)
    except (ValueError, TypeError, KeyError) as err:
        raise MalformedStorageError(f"Stored schema {version} is malformed: {err}") from err
    return snapshot


def _validate_snapshot(snapshot: StorageSnapshot) -> None:
    if snapshot.schema_version != STORAGE_SCHEMA_VERSION:
        raise ValueError("Decoded snapshot has an unsupported schema version")
    _require_unique((rule.id for rule in snapshot.rules), "rule")
    _require_unique((recipient.id for recipient in snapshot.recipients), "recipient")
    _require_unique((group.id for group in snapshot.groups), "group")
    _require_unique((record.id for record in snapshot.activity), "activity record")
    try:
        for rule in snapshot.rules:
            require_valid_rule(rule)
        for recipient in snapshot.recipients:
            require_valid_recipient(recipient)
        for group in snapshot.groups:
            require_valid_group(group)
    except DomainValidationError as err:
        raise ValueError(str(err)) from err


def _require_unique(values: Iterable[str], label: str) -> None:
    identifiers = list(values)
    if len(set(identifiers)) != len(identifiers):
        raise ValueError(f"Duplicate {label} ID")


__all__ = [
    "MIGRATIONS",
    "FutureStorageVersionError",
    "MalformedStorageError",
    "MissingStorageMigrationError",
    "StorageMigrationError",
    "migrate_storage",
    "register_migration",
]
