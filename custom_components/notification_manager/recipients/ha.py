"""Thin Home Assistant snapshot adapter for recipient discovery."""

from __future__ import annotations

from typing import Any

from ..models import RecipientProfile
from .discovery import (
    DiscoveryResult,
    PersonSnapshot,
    UserSnapshot,
    discover_recipients,
)


class HomeAssistantRecipientDiscovery:
    def __init__(self, hass: Any) -> None:
        self._hass = hass

    async def async_discover(
        self, existing: tuple[RecipientProfile, ...]
    ) -> DiscoveryResult:
        users = tuple(
            UserSnapshot(user.id, user.name or "", user.is_admin)
            for user in await self._hass.auth.async_get_users()
            if user.is_active
        )
        people = tuple(
            PersonSnapshot(
                state.entity_id,
                str(state.attributes.get("friendly_name") or state.name or state.entity_id),
                _optional_string(state.attributes.get("user_id")),
            )
            for state in self._hass.states.async_all("person")
        )
        notify_services = tuple(
            f"notify.{service_name}"
            for service_name in self._hass.services.async_services().get("notify", {})
        )
        return discover_recipients(users, people, notify_services, existing)


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


__all__ = ["HomeAssistantRecipientDiscovery"]
