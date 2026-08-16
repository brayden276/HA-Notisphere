from __future__ import annotations

import asyncio
from dataclasses import replace
from datetime import UTC, datetime

from custom_components.notification_manager.manager import NotificationManager, RequestUser
from custom_components.notification_manager.models import (
    ActivityStatus,
    DeliveryEndpoint,
    EndpointType,
    RecipientProfile,
    TriggerType,
)
from custom_components.notification_manager.runtime import RuntimeManager
from custom_components.notification_manager.storage import InMemoryStorageBackend, RuleRepository

from .factories import make_rule


def run(coroutine):  # type: ignore[no-untyped-def]
    return asyncio.run(coroutine)


def test_created_rule_is_indexed_fires_delivers_and_records_activity() -> None:
    class States:
        def __init__(self) -> None:
            self.values = {"binary_sensor.garage_door": "off"}

        def get_state(self, entity_id: str) -> str | None:
            return self.values.get(entity_id)

    class Delivery:
        def __init__(self) -> None:
            self.targets: list[str] = []

        async def async_send(
            self, endpoint, content, policy=None, *, replacement_key=None
        ) -> None:  # type: ignore[no-untyped-def]
            self.targets.append(endpoint.target)

    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend())
        delivery = Delivery()
        manager = NotificationManager(repository, delivery)
        await manager.recipients.replace_discovered_recipients(
            (
                RecipientProfile(
                    "recipient-admin",
                    "admin",
                    "Admin",
                    (
                        DeliveryEndpoint(
                            "admin-phone",
                            EndpointType.HA_NOTIFY,
                            "notify.mobile_app_admin",
                            "mobile_app",
                        ),
                    ),
                ),
            )
        )
        admin = RequestUser("admin", True, "Admin")

        async def directory() -> tuple[RequestUser, ...]:
            return (admin,)

        states = States()
        runtime = RuntimeManager(
            repository,
            manager.recipients,
            delivery,
            states,
            directory,
            clock=lambda: datetime(2026, 8, 16, 12, 0, tzinfo=UTC),
            id_factory=iter(f"flow-{index}" for index in range(20)).__next__,
        )
        manager.set_runtime(runtime)
        await manager.async_start()

        rule = replace(
            make_rule(),
            trigger=replace(make_rule().trigger, type=TriggerType.BINARY_STATE),
        )
        saved = await manager.create_rule(rule, admin)
        assert runtime.watchers.rule_ids_for("binary_sensor.garage_door") == (saved.id,)

        states.values["binary_sensor.garage_door"] = "on"
        await runtime.async_state_changed("binary_sensor.garage_door", "off", "on")

        activity = await repository.list_activity()
        assert delivery.targets == ["notify.mobile_app_admin"]
        assert len(activity) == 1
        assert activity[0].rule_id == saved.id
        assert activity[0].status is ActivityStatus.SENT
        await manager.async_stop()

    run(scenario())
