"""Home Assistant Notification Manager integration."""

from __future__ import annotations

from typing import Any

from .capabilities.ha import HomeAssistantCapabilityDiscovery
from .const import DATA_MANAGER, DOMAIN, INTEGRATION_VERSION
from .ha_storage import HomeAssistantStorageBackend
from .health import HomeAssistantRuleHealthCoordinator
from .manager import NotificationManager
from .models import RULE_SCHEMA_VERSION, STORAGE_SCHEMA_VERSION
from .observability import ObservabilityService
from .panel import async_register_panel, async_unregister_panel
from .recipients.delivery import HomeAssistantNotificationDelivery
from .recipients.ha import HomeAssistantRecipientDiscovery
from .runtime import RuntimeManager
from .runtime.ha import HomeAssistantRuntimeAdapter
from .storage import RuleRepository


async def async_setup_entry(hass: Any, entry: Any) -> bool:
    """Set up Notification Manager from a config entry."""

    from .websocket import async_register_websocket_commands

    repository = RuleRepository(HomeAssistantStorageBackend(hass))
    delivery = HomeAssistantNotificationDelivery(hass)
    capability_discovery = HomeAssistantCapabilityDiscovery(hass)
    manager = NotificationManager(
        repository, delivery, capability_discovery
    )
    discovery = await HomeAssistantRecipientDiscovery(hass).async_discover(
        (await repository.snapshot()).recipients
    )
    await manager.recipients.replace_discovered_recipients(discovery.recipients)
    manager.set_discovery_issues(tuple(item.to_dict() for item in discovery.unconfirmed))
    runtime_adapter = HomeAssistantRuntimeAdapter(hass)

    from homeassistant.util import dt as dt_util

    runtime = RuntimeManager(
        repository,
        manager.recipients,
        delivery,
        runtime_adapter,
        runtime_adapter.async_directory_users,
        state_listener=runtime_adapter,
        clock=dt_util.now,
    )
    manager.set_runtime(runtime)
    manager.set_health(
        HomeAssistantRuleHealthCoordinator(
            hass,
            repository,
            runtime,
            invalidate_capabilities=capability_discovery.invalidate,
        )
    )
    manager.observability = ObservabilityService(
        repository, version=INTEGRATION_VERSION, runtime=runtime
    )
    await manager.async_start()
    domain_data = hass.data.setdefault(DOMAIN, {})
    domain_data[entry.entry_id] = {DATA_MANAGER: manager}
    async_register_websocket_commands(hass)
    await async_register_panel(hass)
    return True


async def async_unload_entry(hass: Any, entry: Any) -> bool:
    """Unload Notification Manager."""

    domain_data = hass.data.get(DOMAIN, {})
    entry_data = domain_data.pop(entry.entry_id, None)
    if entry_data is not None:
        await entry_data[DATA_MANAGER].async_stop()
    if not domain_data:
        hass.data.pop(DOMAIN, None)
        async_unregister_panel(hass)
    return True

__all__ = ["DOMAIN", "RULE_SCHEMA_VERSION", "STORAGE_SCHEMA_VERSION"]
