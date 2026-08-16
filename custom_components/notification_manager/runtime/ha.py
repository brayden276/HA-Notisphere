"""Thin Home Assistant state and user-directory runtime adapter."""

from __future__ import annotations

from typing import Any

from ..manager import RequestUser
from .manager import StateChangeCallback, Unsubscribe


class HomeAssistantRuntimeAdapter:
    """Expose current states, state events and active users without polluting pure runtime code."""

    def __init__(self, hass: Any) -> None:
        self._hass = hass

    def get_state(self, entity_id: str) -> str | None:
        state = self._hass.states.get(entity_id)
        return state.state if state is not None else None

    async def async_directory_users(self) -> tuple[RequestUser, ...]:
        return tuple(
            RequestUser(user.id, user.is_admin, user.name or "")
            for user in await self._hass.auth.async_get_users()
            if user.is_active
        )

    def async_listen(self, callback: StateChangeCallback) -> Unsubscribe:
        from homeassistant.const import EVENT_STATE_CHANGED

        def state_changed(event: Any) -> None:
            entity_id = event.data.get("entity_id")
            if not isinstance(entity_id, str):
                return
            old = event.data.get("old_state")
            new = event.data.get("new_state")
            old_state = getattr(old, "state", None)
            new_state = getattr(new, "state", None)
            self._hass.async_create_task(callback(entity_id, old_state, new_state))

        return self._hass.bus.async_listen(EVENT_STATE_CHANGED, state_changed)


__all__ = ["HomeAssistantRuntimeAdapter"]
