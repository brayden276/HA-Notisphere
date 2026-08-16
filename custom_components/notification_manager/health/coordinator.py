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
        from homeassistant.helpers.entity_registry import EVENT_ENTITY_REGISTRY_UPDATED

        await self.async_reconcile()
        self._unsubscribers.extend(
            (
                self._hass.bus.async_listen(
                    EVENT_STATE_CHANGED, self._state_changed
                ),
                self._hass.bus.async_listen(
                    EVENT_ENTITY_REGISTRY_UPDATED, self._registry_changed
                ),
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
        if self._invalidate_capabilities is not None:
            self._invalidate_capabilities()
        entity_id = event.data.get("entity_id")
        if isinstance(entity_id, str) and entity_id in self._tracked_entity_ids:
            self.request_reconciliation()

    def _registry_changed(self, _event: Any) -> None:
        if self._invalidate_capabilities is not None:
            self._invalidate_capabilities()
        self.request_reconciliation()


__all__ = ["HealthRuntime", "HomeAssistantRuleHealthCoordinator"]
