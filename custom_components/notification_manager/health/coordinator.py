"""Home Assistant event coordination for bounded rule-health reconciliation."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from contextlib import suppress
from typing import Any, Protocol

from ..models import NotificationRule
from ..storage import RuleRepository
from .ha import HomeAssistantRuleHealthAdapter
from .models import HealthReconciliationReport, HealthUserSnapshot
from .service import RuleHealthReconciliationService

_LOGGER = logging.getLogger(__name__)
_UNAVAILABLE_STATES = frozenset({"unknown", "unavailable"})
_CAPABILITY_ATTRIBUTES = ("friendly_name", "device_class", "unit_of_measurement")
_CAPABILITY_DOMAINS = frozenset({"binary_sensor", "person", "sensor"})


class HealthRuntime(Protocol):
    async def async_upsert_rule(self, rule: NotificationRule) -> None: ...


class HomeAssistantRuleHealthCoordinator:
    """Coalesce relevant HA events into explicit full-world health snapshots."""

    def __init__(
        self,
        hass: Any,
        repository: RuleRepository,
        runtime: HealthRuntime,
        *,
        service: RuleHealthReconciliationService | None = None,
        adapter: HomeAssistantRuleHealthAdapter | None = None,
        invalidate_capabilities: Callable[[], None] | None = None,
    ) -> None:
        self._hass = hass
        self._repository = repository
        self._runtime = runtime
        self._service = service or RuleHealthReconciliationService(repository)
        self._adapter = adapter or HomeAssistantRuleHealthAdapter(hass)
        self._invalidate_capabilities = invalidate_capabilities
        self._tracked_entity_ids: frozenset[str] = frozenset()
        self._unsubscribers: list[Callable[[], None]] = []
        self._reconcile_task: asyncio.Task[None] | None = None
        self._reconcile_requested = False

    async def async_start(self) -> None:
        from homeassistant.const import EVENT_STATE_CHANGED
        from homeassistant.core import callback
        from homeassistant.helpers.entity_registry import EVENT_ENTITY_REGISTRY_UPDATED

        await self.async_reconcile()

        @callback
        def state_event_filter(data: dict[str, Any]) -> bool:
            return self._state_event_filter(data)

        @callback
        def state_changed(event: Any) -> None:
            self._state_changed(event)

        @callback
        def registry_changed(event: Any) -> None:
            self._registry_changed(event)

        self._unsubscribers.append(
            self._hass.bus.async_listen(
                EVENT_STATE_CHANGED,
                state_changed,
                event_filter=state_event_filter,
            )
        )
        self._unsubscribers.append(
            self._hass.bus.async_listen(
                EVENT_ENTITY_REGISTRY_UPDATED, registry_changed
            )
        )

    async def async_stop(self) -> None:
        for unsubscribe in self._unsubscribers:
            with suppress(Exception):
                unsubscribe()
        self._unsubscribers.clear()
        if self._reconcile_task is not None and not self._reconcile_task.done():
            self._reconcile_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._reconcile_task
        self._reconcile_task = None
        self._reconcile_requested = False

    async def async_reconcile(self) -> HealthReconciliationReport:
        """Refresh environment state, persist health, and repair runtime indexes."""

        snapshot = await self._repository.snapshot()
        users = tuple(
            HealthUserSnapshot(user.id, user.is_admin)
            for user in await self._hass.auth.async_get_users()
            if user.is_active
        )
        report = await self._adapter.async_reconcile(
            self._service,
            snapshot.recipients,
            snapshot.groups,
            users,
            snapshot.rules,
        )
        for rule in report.updated_rules:
            await self._runtime.async_upsert_rule(rule)
        latest = await self._repository.list()
        self._tracked_entity_ids = frozenset(
            target.entity_id
            for rule in latest
            for target in (
                rule.trigger.target,
                *(condition.target for condition in rule.conditions),
            )
            if target is not None
        )
        return report

    def request_reconciliation(self) -> None:
        """Request one coalesced reconciliation from a synchronous HA callback."""

        self._reconcile_requested = True
        if self._reconcile_task is None or self._reconcile_task.done():
            self._reconcile_task = self._hass.async_create_task(
                self._run_requested_reconciliation(),
                "notification_manager rule health reconciliation",
            )

    async def _run_requested_reconciliation(self) -> None:
        while self._reconcile_requested:
            self._reconcile_requested = False
            try:
                await self.async_reconcile()
            except asyncio.CancelledError:
                raise
            except Exception:
                _LOGGER.exception("Rule health reconciliation failed")

    def _state_changed(self, event: Any) -> None:
        entity_id = event.data.get("entity_id")
        if not isinstance(entity_id, str):
            return
        old_state = event.data.get("old_state")
        new_state = event.data.get("new_state")
        if (
            self._invalidate_capabilities is not None
            and entity_id.partition(".")[0] in _CAPABILITY_DOMAINS
            and _capability_signature(old_state) != _capability_signature(new_state)
        ):
            self._invalidate_capabilities()
        if (
            entity_id in self._tracked_entity_ids
            and _state_is_available(old_state) != _state_is_available(new_state)
        ):
            self.request_reconciliation()

    def _state_event_filter(self, data: dict[str, Any]) -> bool:
        """Avoid scheduling a Home Assistant job for irrelevant state traffic."""

        entity_id = data.get("entity_id")
        if not isinstance(entity_id, str):
            return False
        old_state = data.get("old_state")
        new_state = data.get("new_state")
        return (
            entity_id in self._tracked_entity_ids
            and _state_is_available(old_state) != _state_is_available(new_state)
        ) or (
            entity_id.partition(".")[0] in _CAPABILITY_DOMAINS
            and _capability_signature(old_state) != _capability_signature(new_state)
        )

    def _registry_changed(self, _event: Any) -> None:
        if self._invalidate_capabilities is not None:
            self._invalidate_capabilities()
        self.request_reconciliation()


def _state_is_available(state: Any) -> bool:
    value = getattr(state, "state", None)
    return isinstance(value, str) and value.casefold() not in _UNAVAILABLE_STATES


def _capability_signature(state: Any) -> tuple[object, ...] | None:
    if state is None:
        return None
    attributes = getattr(state, "attributes", {})
    return (
        _state_is_available(state),
        *(attributes.get(name) for name in _CAPABILITY_ATTRIBUTES),
    )


__all__ = ["HealthRuntime", "HomeAssistantRuleHealthCoordinator"]
