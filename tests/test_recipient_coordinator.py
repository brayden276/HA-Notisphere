from __future__ import annotations

import asyncio
from dataclasses import dataclass
from types import SimpleNamespace

from custom_components.notification_manager.recipients.coordinator import (
    HomeAssistantRecipientDiscoveryCoordinator,
)
from custom_components.notification_manager.recipients.discovery import (
    DiscoveryResult,
    UnconfirmedReason,
    UnconfirmedRelationship,
)


def run(coroutine):  # type: ignore[no-untyped-def]
    return asyncio.run(coroutine)


@dataclass(slots=True)
class Event:
    event_type: str
    data: dict[str, object]


def test_discovery_refresh_events_ignore_normal_person_state_changes() -> None:
    coordinator = HomeAssistantRecipientDiscoveryCoordinator
    assert coordinator.event_requires_refresh(Event("user_added", {"user_id": "user-c"}))
    assert coordinator.event_requires_refresh(
        Event(
            "service_registered",
            {"domain": "notify", "service": "mobile_app_pixel"},
        )
    )
    assert not coordinator.event_requires_refresh(
        Event("service_registered", {"domain": "light", "service": "turn_on"})
    )

    old_state = SimpleNamespace(
        attributes={"friendly_name": "Alice", "user_id": "user-a"}
    )
    assert not coordinator.event_requires_refresh(
        Event(
            "state_changed",
            {
                "entity_id": "person.alice",
                "old_state": old_state,
                "new_state": SimpleNamespace(
                    attributes={"friendly_name": "Alice", "user_id": "user-a"}
                ),
            },
        )
    )
    assert coordinator.event_requires_refresh(
        Event(
            "state_changed",
            {
                "entity_id": "person.alice",
                "old_state": old_state,
                "new_state": SimpleNamespace(
                    attributes={"friendly_name": "Alice Smith", "user_id": "user-a"}
                ),
            },
        )
    )


def test_coordinator_refresh_replaces_directory_and_exposes_ambiguity() -> None:
    async def scenario() -> None:
        class Recipients:
            replaced = None

            async def replace_discovered_recipients(self, recipients):  # type: ignore[no-untyped-def]
                self.replaced = recipients

        class Manager:
            def __init__(self) -> None:
                self.repository = SimpleNamespace(
                    snapshot=self.snapshot,
                )
                self.recipients = Recipients()
                self.issues = ()
                self.reconciled = 0

            async def snapshot(self):  # type: ignore[no-untyped-def]
                return SimpleNamespace(recipients=())

            def set_discovery_issues(self, issues):  # type: ignore[no-untyped-def]
                self.issues = issues

            async def async_reconcile_health(self) -> None:
                self.reconciled += 1

        class Discovery:
            async def async_discover(self, existing):  # type: ignore[no-untyped-def]
                assert existing == ()
                return DiscoveryResult(
                    (),
                    (
                        UnconfirmedRelationship(
                            "notify.mobile_app_shared",
                            UnconfirmedReason.AMBIGUOUS_MATCH,
                            ("user-a", "user-b"),
                        ),
                    ),
                )

        manager = Manager()
        coordinator = HomeAssistantRecipientDiscoveryCoordinator(
            SimpleNamespace(), manager, Discovery()  # type: ignore[arg-type]
        )
        await coordinator.async_refresh()

        assert manager.recipients.replaced == ()
        assert manager.issues[0]["source"] == "notify.mobile_app_shared"
        assert manager.reconciled == 1

    run(scenario())
