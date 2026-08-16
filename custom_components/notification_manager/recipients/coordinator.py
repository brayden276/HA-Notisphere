"""Event-driven Home Assistant recipient discovery lifecycle."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any, Protocol

from .ha import HomeAssistantRecipientDiscovery


class RecipientDiscoveryManager(Protocol):
    repository: Any
    recipients: Any

    def set_discovery_issues(self, issues: tuple[dict[str, object], ...]) -> None: ...

    async def async_reconcile_health(self) -> None: ...


class HomeAssistantRecipientDiscoveryCoordinator:
    """Keep people and Companion App phones current without polling."""

    def __init__(
        self,
        hass: Any,
        manager: RecipientDiscoveryManager,
        discovery: HomeAssistantRecipientDiscovery,
    ) -> None:
        self._hass = hass
        self._manager = manager
        self._discovery = discovery
        self._refresh_lock = asyncio.Lock()
        self._unsubscribers: list[Callable[[], None]] = []

    async def async_refresh(self, *, reconcile_health: bool = True) -> None:
        """Refresh persisted mappings from the latest HA directory snapshot."""

        async with self._refresh_lock:
            existing = (await self._manager.repository.snapshot()).recipients
            result = await self._discovery.async_discover(existing)
            await self._manager.recipients.replace_discovered_recipients(
                result.recipients
            )
            self._manager.set_discovery_issues(
                tuple(item.to_dict() for item in result.unconfirmed)
            )
            if reconcile_health:
                await self._manager.async_reconcile_health()

    async def async_start(self) -> None:
        """Listen for relevant person and notify-service changes."""

        if self._unsubscribers:
            return
        from homeassistant.auth import (
            EVENT_USER_ADDED,
            EVENT_USER_REMOVED,
            EVENT_USER_UPDATED,
        )
        from homeassistant.const import (
            EVENT_SERVICE_REGISTERED,
            EVENT_SERVICE_REMOVED,
            EVENT_STATE_CHANGED,
        )

        for event_type in (
            EVENT_SERVICE_REGISTERED,
            EVENT_SERVICE_REMOVED,
            EVENT_STATE_CHANGED,
            EVENT_USER_ADDED,
            EVENT_USER_REMOVED,
            EVENT_USER_UPDATED,
        ):
            self._unsubscribers.append(
                self._hass.bus.async_listen(event_type, self._async_handle_event)
            )

    async def async_stop(self) -> None:
        """Remove Home Assistant listeners."""

        for unsubscribe in self._unsubscribers:
            unsubscribe()
        self._unsubscribers.clear()

    async def _async_handle_event(self, event: Any) -> None:
        if self.event_requires_refresh(event):
            await self.async_refresh()

    @staticmethod
    def event_requires_refresh(event: Any) -> bool:
        """Return whether an HA event can change recipient discovery."""

        data = event.data
        if event.event_type in {"user_added", "user_removed", "user_updated"}:
            return True
        if event.event_type in {"service_registered", "service_removed"}:
            domain = data.get("domain")
            service = data.get("service")
            return (
                domain == "notify"
                and isinstance(service, str)
                and service.startswith("mobile_app_")
            )
        if event.event_type != "state_changed":
            return False
        entity_id = data.get("entity_id")
        if not isinstance(entity_id, str) or not entity_id.startswith("person."):
            return False
        old_state = data.get("old_state")
        new_state = data.get("new_state")
        if old_state is None or new_state is None:
            return True
        old_attributes = old_state.attributes
        new_attributes = new_state.attributes
        return any(
            old_attributes.get(key) != new_attributes.get(key)
            for key in ("friendly_name", "user_id")
        )


__all__ = ["HomeAssistantRecipientDiscoveryCoordinator"]
