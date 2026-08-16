from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass
from types import ModuleType, SimpleNamespace

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


def test_start_marks_home_assistant_event_filters_as_callbacks(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    homeassistant = ModuleType("homeassistant")
    homeassistant.__path__ = []  # type: ignore[attr-defined]
    auth = ModuleType("homeassistant.auth")
    auth.EVENT_USER_ADDED = "user_added"  # type: ignore[attr-defined]
    auth.EVENT_USER_REMOVED = "user_removed"  # type: ignore[attr-defined]
    auth.EVENT_USER_UPDATED = "user_updated"  # type: ignore[attr-defined]
    const = ModuleType("homeassistant.const")
    const.EVENT_SERVICE_REGISTERED = "service_registered"  # type: ignore[attr-defined]
    const.EVENT_SERVICE_REMOVED = "service_removed"  # type: ignore[attr-defined]
    const.EVENT_STATE_CHANGED = "state_changed"  # type: ignore[attr-defined]
    core = ModuleType("homeassistant.core")

    def callback(function):  # type: ignore[no-untyped-def]
        function._hass_callback = True
        return function

    core.callback = callback  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "homeassistant", homeassistant)
    monkeypatch.setitem(sys.modules, "homeassistant.auth", auth)
    monkeypatch.setitem(sys.modules, "homeassistant.const", const)
    monkeypatch.setitem(sys.modules, "homeassistant.core", core)

    listeners: list[tuple[str, object | None]] = []
    unsubscribed = 0

    class Bus:
        def async_listen(self, event_type, _listener, event_filter=None):  # type: ignore[no-untyped-def]
            listeners.append((event_type, event_filter))

            def unsubscribe() -> None:
                nonlocal unsubscribed
                unsubscribed += 1

            return unsubscribe

    async def scenario() -> None:
        coordinator = HomeAssistantRecipientDiscoveryCoordinator(
            SimpleNamespace(bus=Bus()), SimpleNamespace(), SimpleNamespace()
        )
        await coordinator.async_start()
        assert len(listeners) == 6
        assert all(
            getattr(event_filter, "_hass_callback", False)
            for _, event_filter in listeners[:3]
        )
        await coordinator.async_stop()

    run(scenario())
    assert unsubscribed == 6


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
