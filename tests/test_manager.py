from __future__ import annotations

import asyncio
from dataclasses import replace

import pytest

from custom_components.notification_manager.manager import (
    NotificationManager,
    PermissionDeniedError,
    RequestUser,
)
from custom_components.notification_manager.models import RuleScope
from custom_components.notification_manager.storage import (
    InMemoryStorageBackend,
    RevisionConflictError,
    RuleRepository,
)

from .factories import make_rule


def run(coroutine):  # type: ignore[no-untyped-def]
    return asyncio.run(coroutine)


class RecordingRuntime:
    def __init__(self) -> None:
        self.events: list[tuple[str, str | None]] = []

    async def async_start(self) -> None:
        self.events.append(("start", None))

    async def async_stop(self) -> None:
        self.events.append(("stop", None))

    async def async_upsert_rule(self, rule) -> None:  # type: ignore[no-untyped-def]
        self.events.append(("upsert", rule.id))

    async def async_remove_rule(self, rule_id: str) -> None:
        self.events.append(("remove", rule_id))

    async def async_test_rule(self, rule):  # type: ignore[no-untyped-def]
        self.events.append(("test", rule.id))
        return None


def test_admin_crud_and_revision_guard() -> None:
    async def scenario() -> None:
        manager = NotificationManager(RuleRepository(InMemoryStorageBackend()))
        admin = RequestUser("admin-1", True, "Admin")
        created = await manager.create_rule(make_rule(), admin)
        assert created.owner_user_id == admin.id
        assert created.revision == 1
        changed = replace(created, name="Changed")
        updated = await manager.update_rule(changed, 1, admin)
        assert updated.revision == 2
        with pytest.raises(RevisionConflictError):
            await manager.set_rule_enabled(updated.id, False, 1, admin)
        await manager.delete_rule(updated.id, 2, admin)
        assert await manager.list_rules(admin) == ()

    run(scenario())


def test_non_admin_sees_and_changes_only_their_personal_rules() -> None:
    async def scenario() -> None:
        manager = NotificationManager(RuleRepository(InMemoryStorageBackend()))
        admin = RequestUser("admin", True)
        user = RequestUser("user-1", False)
        other = RequestUser("user-2", False)
        household = await manager.create_rule(make_rule("household"), admin)
        personal = replace(make_rule("personal"), scope=RuleScope.PERSONAL)
        personal = await manager.create_rule(personal, user)

        assert await manager.list_rules(user) == (personal,)
        assert await manager.list_rules(other) == ()
        with pytest.raises(PermissionDeniedError):
            await manager.get_rule(household.id, user)
        with pytest.raises(PermissionDeniedError):
            await manager.create_rule(make_rule("blocked"), user)

    run(scenario())


def test_bootstrap_is_server_canonical_and_permission_filtered() -> None:
    async def scenario() -> None:
        manager = NotificationManager(RuleRepository(InMemoryStorageBackend()))
        user = RequestUser("user-1", False, "Household member")
        personal = replace(make_rule(), scope=RuleScope.PERSONAL)
        await manager.create_rule(personal, user)
        bootstrap = await manager.bootstrap(user)
        assert bootstrap["current_user"] == {
            "id": "user-1",
            "name": "Household member",
            "is_admin": False,
        }
        assert [rule["id"] for rule in bootstrap["rules"]] == [personal.id]

    run(scenario())


def test_runtime_tracks_only_successful_persisted_mutations_and_lifecycle() -> None:
    async def scenario() -> None:
        manager = NotificationManager(RuleRepository(InMemoryStorageBackend()))
        runtime = RecordingRuntime()
        manager.set_runtime(runtime)
        admin = RequestUser("admin-1", True)

        await manager.async_start()
        created = await manager.create_rule(make_rule(), admin)
        updated = await manager.set_rule_enabled(created.id, False, created.revision, admin)
        with pytest.raises(RevisionConflictError):
            await manager.set_rule_enabled(updated.id, True, created.revision, admin)
        await manager.delete_rule(updated.id, updated.revision, admin)
        await manager.async_stop()

        assert runtime.events == [
            ("start", None),
            ("upsert", created.id),
            ("upsert", created.id),
            ("remove", created.id),
            ("stop", None),
        ]

    run(scenario())
