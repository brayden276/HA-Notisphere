"""Home Assistant Store adapter."""

from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, cast

from .const import STORAGE_KEY, STORAGE_VERSION
from .models import JsonValue

if TYPE_CHECKING:
    from .storage import StorageSnapshot

_ACTIVITY_SAVE_DELAY_SECONDS = 5


class HomeAssistantStorageBackend:
    """Adapt Home Assistant's versioned Store to the domain backend protocol."""

    def __init__(self, hass: Any) -> None:
        from homeassistant.helpers.storage import Store

        self._store = Store[dict[str, JsonValue]](
            hass,
            STORAGE_VERSION,
            STORAGE_KEY,
            serialize_in_event_loop=False,
        )

    async def load(self) -> Mapping[str, JsonValue] | None:
        data = await self._store.async_load()
        return cast(dict[str, JsonValue] | None, data)

    async def save(self, data: Mapping[str, JsonValue]) -> None:
        await self._store.async_save(dict(data))

    def save_snapshot_delayed(self, snapshot: StorageSnapshot) -> None:
        """Defer both conversion and serialisation of immutable activity state."""

        self._store.async_delay_save(
            snapshot.to_dict,
            _ACTIVITY_SAVE_DELAY_SECONDS,
        )
