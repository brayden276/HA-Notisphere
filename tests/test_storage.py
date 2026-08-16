from __future__ import annotations

import asyncio
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from custom_components.notification_manager.models import ActivityRecord, ActivityStatus
from custom_components.notification_manager.storage import (
    InMemoryStorageBackend,
    RevisionConflictError,
    RuleNotFoundError,
    RuleRepository,
)

from .factories import make_rule


def run(coroutine):  # type: ignore[no-untyped-def]
    return asyncio.run(coroutine)


def test_repository_crud_and_revision_conflicts() -> None:
    async def scenario() -> None:
        backend = InMemoryStorageBackend()
        repository = RuleRepository(backend)
        created = await repository.create(make_rule())
        assert created.revision == 1
        assert await repository.get(created.id) == created
        assert await repository.list() == (created,)

        changed = replace(created, name="Garage still open")
        updated = await repository.save(changed, expected_revision=1)
        assert updated.revision == 2
        assert updated.created_at == created.created_at

        with pytest.raises(RevisionConflictError) as error:
            await repository.update(changed, expected_revision=1)
        assert error.value.actual_revision == 2

        with pytest.raises(RevisionConflictError):
            await repository.delete(created.id, expected_revision=1)
        await repository.delete(created.id, expected_revision=2)
        assert await repository.get(created.id) is None
        with pytest.raises(RuleNotFoundError):
            await repository.delete(created.id, expected_revision=2)

    run(scenario())


def test_repository_persists_across_instances_and_backend_returns_copies() -> None:
    async def scenario() -> None:
        backend = InMemoryStorageBackend()
        first = RuleRepository(backend)
        created = await first.save(make_rule())
        raw = await backend.load()
        assert raw is not None
        raw["rules"].clear()  # type: ignore[union-attr]

        second = RuleRepository(backend)
        assert await second.get(created.id) == created

    run(scenario())


def test_immutable_snapshots_are_reused_and_noop_directory_writes_are_skipped() -> None:
    class CountingBackend(InMemoryStorageBackend):
        def __init__(self) -> None:
            super().__init__()
            self.saves = 0

        async def save(self, data):  # type: ignore[no-untyped-def]
            self.saves += 1
            await super().save(data)

    async def scenario() -> None:
        backend = CountingBackend()
        repository = RuleRepository(backend)
        first = await repository.snapshot()
        second = await repository.snapshot()
        assert first is second

        await repository.replace_recipients(())
        await repository.replace_groups(())
        assert backend.saves == 0

    run(scenario())


def test_activity_uses_delayed_backend_save_when_available() -> None:
    class DelayedBackend(InMemoryStorageBackend):
        def __init__(self) -> None:
            super().__init__()
            self.delayed = 0

        def save_snapshot_delayed(self, snapshot):  # type: ignore[no-untyped-def]
            self.delayed += 1
            self._data = snapshot.to_dict()

    async def scenario() -> None:
        now = datetime(2026, 8, 15, 10, 0, tzinfo=UTC)
        backend = DelayedBackend()
        repository = RuleRepository(backend, clock=lambda: now)
        await repository.append_activity(_activity(1, now))

        assert backend.delayed == 1
        assert [item.id for item in await repository.list_activity()] == ["activity-1"]

    run(scenario())


def _activity(identifier: int, timestamp: datetime) -> ActivityRecord:
    return ActivityRecord(
        id=f"activity-{identifier}",
        rule_id="rule-1",
        occurrence_id=f"occurrence-{identifier}",
        timestamp=timestamp,
        trigger_summary="Triggered",
        status=ActivityStatus.SENT,
    )


def test_activity_retention_applies_age_and_record_count_limits() -> None:
    async def scenario() -> None:
        now = datetime(2026, 8, 15, 10, 0, tzinfo=UTC)
        repository = RuleRepository(
            InMemoryStorageBackend(),
            clock=lambda: now,
            activity_retention_days=30,
            activity_retention_records=3,
        )
        await repository.append_activity(_activity(0, now - timedelta(days=31)))
        for index in range(1, 5):
            await repository.append_activity(_activity(index, now - timedelta(minutes=index)))

        records = await repository.list_activity()
        assert [record.id for record in records] == ["activity-1", "activity-2", "activity-3"]

    run(scenario())
