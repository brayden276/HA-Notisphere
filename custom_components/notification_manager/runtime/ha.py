"""Thin Home Assistant state and user-directory runtime adapter."""

from __future__ import annotations

from typing import Any

from ..manager import RequestUser
from .manager import StateChangeCallback, Unsubscribe


class HomeAssistantRuntimeAdapter:
    """Expose current states, state events and active users without polluting pure runtime code."""

    def __init__(self, hass: Any) -> None:
        self._hass = hass
        self._callback: StateChangeCallback | None = None
        self._entity_ids: tuple[str, ...] = ()
        self._unsubscribe: Unsubscribe | None = None

    def get_state(self, entity_id: str) -> str | None:
        state = self._hass.states.get(entity_id)
        return state.state if state is not None else None

    async def async_directory_users(self) -> tuple[RequestUser, ...]:
        return tuple(
            RequestUser(user.id, user.is_admin, user.name or "")
            for user in await self._hass.auth.async_get_users()
            if user.is_active
        )

    def async_listen(
        self, callback: StateChangeCallback, entity_ids: tuple[str, ...]
    ) -> Unsubscribe:
        self._callback = callback
        self._entity_ids = entity_ids
        self._replace_listener()

        def unsubscribe() -> None:
            if self._unsubscribe is not None:
                self._unsubscribe()
                self._unsubscribe = None
            self._callback = None
            self._entity_ids = ()

        return unsubscribe

    def async_update_entity_ids(self, entity_ids: tuple[str, ...]) -> None:
        """Replace the indexed HA subscription only when watched targets change."""

        if entity_ids == self._entity_ids:
            return
        self._entity_ids = entity_ids
        if self._callback is not None:
            self._replace_listener()

    def _replace_listener(self) -> None:
        from homeassistant.helpers.event import async_track_state_change_event

        if self._unsubscribe is not None:
            self._unsubscribe()

        async def state_changed(event: Any) -> None:
            callback = self._callback
            if callback is None:
                return
            entity_id = event.data.get("entity_id")
            if not isinstance(entity_id, str):
                return
            old = event.data.get("old_state")
            new = event.data.get("new_state")
            old_state = getattr(old, "state", None)
            new_state = getattr(new, "state", None)
            await callback(entity_id, old_state, new_state)

        self._unsubscribe = async_track_state_change_event(
            self._hass, self._entity_ids, state_changed
        )


__all__ = ["HomeAssistantRuntimeAdapter"]
