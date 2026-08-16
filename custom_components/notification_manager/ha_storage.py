"""Home Assistant Store adapter."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, cast

from .const import STORAGE_KEY, STORAGE_VERSION
from .models import JsonValue


class HomeAssistantStorageBackend:
    """Adapt Home Assistant's versioned Store to the domain backend protocol."""

    def __init__(self, hass: Any) -> None:
        from homeassistant.helpers.storage import Store

        self._store = Store[dict[str, JsonValue]](hass, STORAGE_VERSION, STORAGE_KEY)

    async def load(self) -> Mapping[str, JsonValue] | None:
        data = await self._store.async_load()
        return cast(dict[str, JsonValue] | None, data)

    async def save(self, data: Mapping[str, JsonValue]) -> None:
        await self._store.async_save(dict(data))

