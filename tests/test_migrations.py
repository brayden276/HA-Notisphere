from __future__ import annotations

import pytest

from custom_components.notification_manager import migrations
from custom_components.notification_manager.migrations import (
    FutureStorageVersionError,
    MalformedStorageError,
    migrate_storage,
    register_migration,
)
from custom_components.notification_manager.models import STORAGE_SCHEMA_VERSION
from custom_components.notification_manager.storage import StorageSnapshot

from .factories import make_rule


def test_current_v1_snapshot_loads() -> None:
    snapshot = StorageSnapshot(rules=(make_rule(),))
    assert migrate_storage(snapshot.to_dict()) == snapshot


@pytest.mark.parametrize(
    "raw",
    [
        None,
        {},
        {"schema_version": "1"},
        {"schema_version": 1, "rules": "bad", "recipients": [], "groups": [], "activity": []},
        {
            "schema_version": 1,
            "rules": [],
            "recipients": [],
            "groups": [],
            "activity": [],
            "preferences": [],
        },
    ],
)
def test_malformed_data_is_rejected(raw: object) -> None:
    with pytest.raises(MalformedStorageError):
        migrate_storage(raw)


def test_future_schema_is_rejected_explicitly() -> None:
    raw = StorageSnapshot().to_dict()
    raw["schema_version"] = STORAGE_SCHEMA_VERSION + 1
    with pytest.raises(FutureStorageVersionError) as error:
        migrate_storage(raw)
    assert error.value.stored_version == 2


def test_migration_registry_rejects_duplicate_source_versions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(migrations, "MIGRATIONS", {})

    def migration(data):  # type: ignore[no-untyped-def]
        return data

    register_migration(1, migration)
    with pytest.raises(ValueError, match="already registered"):
        register_migration(1, migration)


def test_registered_migration_advances_one_schema_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(migrations, "MIGRATIONS", {})
    monkeypatch.setattr(migrations, "STORAGE_SCHEMA_VERSION", 2)

    def migration(data: dict) -> dict:  # type: ignore[type-arg]
        return {**data, "schema_version": 2, "preferences": {"migrated": True}}

    register_migration(1, migration)
    migrated = migrate_storage(StorageSnapshot().to_dict())

    assert migrated.schema_version == 2
    assert migrated.to_dict()["preferences"] == {"migrated": True}
