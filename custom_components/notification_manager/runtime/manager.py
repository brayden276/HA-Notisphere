"""Runtime lifecycle, state transitions, delivery and operational health."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable, Mapping
from contextlib import suppress
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from typing import Protocol, TypeAlias
from uuid import uuid4

from ..models import (
    ActivityRecord,
    ActivityStatus,
    HealthIssue,
    NotificationRule,
    RecipientResult,
    RecipientResultStatus,
    RuleHealth,
    RuleHealthStatus,
    TriggerType,
)
from ..recipients.delivery import NotificationDelivery
from ..recipients.manager import RecipientManager
from ..recipients.resolver import (
    AudienceResolution,
    RequestIdentity,
    ResolvedDelivery,
    SkippedDelivery,
    required_endpoint_capabilities,
)
from ..storage import RevisionConflictError, RuleNotFoundError, RuleRepository
from .evaluator import ConditionEvaluator, StateProvider, _state_is_available
from .timer_manager import TimerManager
from .watcher_registry import WatcherRegistry

_LOGGER = logging.getLogger(__name__)

DirectoryUsers: TypeAlias = Callable[[], Awaitable[tuple[RequestIdentity, ...]]]
IdFactory: TypeAlias = Callable[[], str]
StateChangeCallback: TypeAlias = Callable[[str, str | None, str | None], Awaitable[None]]
Unsubscribe: TypeAlias = Callable[[], None]


class StateListener(Protocol):
    """Structural state-listener boundary implemented by the HA adapter."""

    def async_listen(self, callback: StateChangeCallback) -> Unsubscribe: ...


@dataclass(frozen=True, slots=True)
class _DeliveryOutcome:
    status: ActivityStatus
    results: tuple[RecipientResult, ...]
    reason: str | None


@dataclass(frozen=True, slots=True)
class _OwnerIdentity:
    id: str
    is_admin: bool = False


class RuntimeManager:
    """Run enabled binary rules while isolating failures from the event source."""

    def __init__(
        self,
        repository: RuleRepository,
        recipients: RecipientManager,
        delivery: NotificationDelivery,
        state_provider: StateProvider,
        directory_users: DirectoryUsers,
        *,
        state_listener: StateListener | None = None,
        watchers: WatcherRegistry | None = None,
        timers: TimerManager | None = None,
        condition_evaluator: ConditionEvaluator | None = None,
        clock: Callable[[], datetime] | None = None,
        id_factory: IdFactory | None = None,
        max_delivery_concurrency: int = 4,
    ) -> None:
        if max_delivery_concurrency <= 0:
            raise ValueError("Delivery concurrency must be greater than zero")
        self._repository = repository
        self._recipients = recipients
        self._delivery = delivery
        self._state_provider = state_provider
        self._directory_users = directory_users
        self._state_listener = state_listener
        self._watchers = watchers or WatcherRegistry()
        self._timers = timers or TimerManager()
        self._clock = clock or (lambda: datetime.now(UTC))
        self._condition_evaluator = condition_evaluator or ConditionEvaluator(
            state_provider, self._clock
        )
        self._id_factory = id_factory or (lambda: str(uuid4()))
        self._delivery_limit = asyncio.Semaphore(max_delivery_concurrency)
        self._rules: dict[str, NotificationRule] = {}
        self._last_delivery_at: dict[str, datetime] = {}
        self._started = False
        self._unsubscribe: Unsubscribe | None = None

    @property
    def watchers(self) -> WatcherRegistry:
        return self._watchers

    @property
    def timers(self) -> TimerManager:
        return self._timers

    async def async_start(self) -> None:
        if self._started:
            return
        await self.async_reload()
        if self._state_listener is not None:
            self._unsubscribe = self._state_listener.async_listen(self.async_state_changed)
        self._started = True

    async def async_stop(self) -> None:
        self._started = False
        if self._unsubscribe is not None:
            with suppress(Exception):
                self._unsubscribe()
            self._unsubscribe = None
        self._timers.cancel_all()
        self._watchers.clear()
        self._rules.clear()
        self._last_delivery_at.clear()

    async def async_reload(self) -> None:
        """Rebuild all indexes and restart duration timing from current state."""

        snapshot = await self._repository.snapshot()
        enabled = tuple(rule for rule in snapshot.rules if rule.enabled)
        self._timers.cancel_all()
        self._rules = {rule.id: rule for rule in enabled}
        self._last_delivery_at.clear()
        self._watchers.rebuild(enabled)
        for rule in enabled:
            if rule.trigger.type is TriggerType.BINARY_STATE_DURATION:
                self._start_duration_if_current(rule)

    async def async_upsert_rule(self, rule: NotificationRule) -> None:
        """Synchronise one successfully persisted create, update or enable mutation."""

        self._timers.cancel_rule(rule.id)
        self._last_delivery_at.pop(rule.id, None)
        self._watchers.upsert(rule)
        if not rule.enabled:
            self._rules.pop(rule.id, None)
            return
        self._rules[rule.id] = rule
        if rule.trigger.type is TriggerType.BINARY_STATE_DURATION:
            self._start_duration_if_current(rule)

    async def async_remove_rule(self, rule_id: str) -> None:
        """Remove a successfully deleted rule and cancel all pending work."""

        self._timers.cancel_rule(rule_id)
        self._watchers.remove(rule_id)
        self._rules.pop(rule_id, None)
        self._last_delivery_at.pop(rule_id, None)

    async def async_test_rule(
        self, rule: NotificationRule, *, persist_activity: bool = True
    ) -> ActivityRecord:
        """Deliver one explicit test without evaluating trigger or conditions."""

        directory = await self._directory_users()
        owner = next((user for user in directory if user.id == rule.owner_user_id), None)
        current_user = owner or _OwnerIdentity(rule.owner_user_id)
        resolution = await self._recipients.resolve_audiences(
            rule.audiences,
            current_user,
            directory,
            required_endpoint_capabilities(rule),
        )
        outcome = await self._deliver(rule, resolution)
        reason = (
            "Test notification sent."
            if outcome.status is ActivityStatus.SENT
            else outcome.reason
        )
        return await self._append_activity(
            rule,
            ActivityStatus.TEST,
            outcome.results,
            reason,
            trigger_summary=f"Test: {rule.name}",
            persist=persist_activity,
        )

    async def async_state_changed(
        self, entity_id: str, old_state: str | None, new_state: str | None
    ) -> None:
        """Process one HA-style state transition without allowing failures to escape."""

        await asyncio.gather(
            *(
                self._safe_process_transition(rule_id, old_state, new_state)
                for rule_id in self._watchers.rule_ids_for(entity_id)
            )
        )

    async def _safe_process_transition(
        self, rule_id: str, old_state: str | None, new_state: str | None
    ) -> None:
        try:
            rule = self._rules.get(rule_id)
            if rule is None or not rule.enabled:
                return
            expected = self._trigger_state(rule)
            if rule.trigger.type is TriggerType.BINARY_STATE:
                if (
                    _state_is_available(old_state)
                    and _state_is_available(new_state)
                    and new_state == expected
                    and old_state != expected
                ):
                    await self._execute(rule.id)
                return
            if rule.trigger.type is TriggerType.BINARY_STATE_DURATION:
                if not _state_is_available(new_state) or new_state != expected:
                    self._timers.cancel_rule(rule.id)
                elif old_state != expected:
                    self._schedule_duration(rule)
        except Exception as err:  # fail-safe boundary for Home Assistant callbacks
            await self._record_runtime_failure(rule_id, err)

    def _start_duration_if_current(self, rule: NotificationRule) -> None:
        target = rule.trigger.target
        if target is None:
            return
        state = self._state_provider.get_state(target.entity_id)
        if _state_is_available(state) and state == self._trigger_state(rule):
            self._schedule_duration(rule)

    def _schedule_duration(self, rule: NotificationRule) -> None:
        duration = self._number_parameter(rule.trigger.parameters, "duration_seconds")
        self._timers.schedule(rule.id, duration, lambda: self._safe_duration_elapsed(rule.id))

    async def _safe_duration_elapsed(self, rule_id: str) -> None:
        try:
            rule = self._rules.get(rule_id)
            if rule is None or not rule.enabled:
                return
            target = rule.trigger.target
            if target is None:
                return
            current = self._state_provider.get_state(target.entity_id)
            if _state_is_available(current) and current == self._trigger_state(rule):
                await self._execute(rule.id)
        except Exception as err:  # fail-safe boundary for timer tasks
            await self._record_runtime_failure(rule_id, err)

    async def _execute(self, rule_id: str) -> None:
        rule = self._rules.get(rule_id)
        if rule is None or not rule.enabled:
            return
        cooldown_remaining = self._cooldown_remaining(rule)
        if cooldown_remaining is not None:
            await self._append_activity(
                rule,
                ActivityStatus.SKIPPED,
                (),
                f"Cooldown active; eligible again in {cooldown_remaining} seconds.",
            )
            return
        conditions = self._condition_evaluator.evaluate(rule.conditions)
        if not conditions.passed:
            await self._append_activity(
                rule,
                ActivityStatus.SKIPPED,
                (),
                conditions.reason or "Notification conditions were not met.",
            )
            if conditions.unavailable:
                await self._set_health(
                    rule.id,
                    RuleHealthStatus.DEGRADED,
                    "condition_unavailable",
                    conditions.reason or "A condition target is unavailable.",
                )
            return

        directory = await self._directory_users()
        owner = next((user for user in directory if user.id == rule.owner_user_id), None)
        current_user = owner or _OwnerIdentity(rule.owner_user_id)
        resolution = await self._recipients.resolve_audiences(
            rule.audiences,
            current_user,
            directory,
            required_endpoint_capabilities(rule),
        )
        outcome = await self._deliver(rule, resolution)
        await self._append_activity(rule, outcome.status, outcome.results, outcome.reason)
        if outcome.status in {ActivityStatus.SENT, ActivityStatus.PARTIAL}:
            self._last_delivery_at[rule.id] = self._now()
        if outcome.status is ActivityStatus.SENT:
            await self._set_health(rule.id, RuleHealthStatus.HEALTHY)
        elif outcome.status is ActivityStatus.PARTIAL:
            await self._set_health(
                rule.id,
                RuleHealthStatus.DEGRADED,
                "delivery_partial",
                outcome.reason or "Some recipients could not be notified.",
            )
        elif outcome.status in {ActivityStatus.FAILED, ActivityStatus.SKIPPED}:
            await self._set_health(
                rule.id,
                RuleHealthStatus.DEGRADED,
                "delivery_failed" if outcome.status is ActivityStatus.FAILED else "no_delivery",
                outcome.reason or "No recipient was notified.",
            )

    async def _deliver(
        self, rule: NotificationRule, resolution: AudienceResolution
    ) -> _DeliveryOutcome:
        skipped_results = tuple(self._skipped_result(item) for item in resolution.skipped)

        async def send(item: ResolvedDelivery) -> RecipientResult:
            try:
                async with self._delivery_limit:
                    await self._delivery.async_send(
                        item.endpoint,
                        rule.content,
                        rule.delivery_policy,
                        replacement_key=rule.id
                        if rule.behaviour.replace_previous
                        else None,
                    )
            except Exception:
                return RecipientResult(
                    item.recipient.id,
                    item.recipient.display_name,
                    item.endpoint.id,
                    item.endpoint.target,
                    RecipientResultStatus.FAILED,
                    "This phone could not be reached.",
                )
            return RecipientResult(
                item.recipient.id,
                item.recipient.display_name,
                item.endpoint.id,
                item.endpoint.target,
                RecipientResultStatus.SENT,
            )

        sent_results = tuple(await asyncio.gather(*(send(item) for item in resolution.deliveries)))
        results = (*sent_results, *skipped_results)
        sent_count = sum(item.status is RecipientResultStatus.SENT for item in results)
        failed_count = sum(item.status is RecipientResultStatus.FAILED for item in results)
        skipped_count = sum(item.status is RecipientResultStatus.SKIPPED for item in results)
        if sent_count and not failed_count and not skipped_count:
            return _DeliveryOutcome(ActivityStatus.SENT, results, None)
        if sent_count:
            reason = (
                f"Sent to {sent_count} recipient(s); {failed_count} failed and "
                f"{skipped_count} skipped."
            )
            return _DeliveryOutcome(ActivityStatus.PARTIAL, results, reason)
        if failed_count:
            return _DeliveryOutcome(
                ActivityStatus.FAILED,
                results,
                f"Delivery failed for {failed_count} recipient(s).",
            )
        return _DeliveryOutcome(
            ActivityStatus.SKIPPED,
            results,
            "No eligible notification endpoints were resolved.",
        )

    async def _append_activity(
        self,
        rule: NotificationRule,
        status: ActivityStatus,
        results: tuple[RecipientResult, ...],
        reason: str | None,
        *,
        trigger_summary: str | None = None,
        persist: bool = True,
    ) -> ActivityRecord:
        now = self._now()
        occurrence_id = self._id_factory()
        record = ActivityRecord(
            id=self._id_factory(),
            rule_id=rule.id,
            occurrence_id=occurrence_id,
            timestamp=now,
            trigger_summary=trigger_summary or self._trigger_summary(rule),
            status=status,
            recipient_results=results,
            reason=reason,
        )
        if persist:
            await self._repository.append_activity(record)
        return record

    async def _record_runtime_failure(self, rule_id: str, err: Exception) -> None:
        _LOGGER.error(
            "Notification rule %s failed during runtime evaluation",
            rule_id,
            exc_info=err,
        )
        reason = "Notification Manager could not evaluate this rule. See Home Assistant logs."
        try:
            rule = self._rules.get(rule_id) or await self._repository.get(rule_id)
        except Exception:
            return
        if rule is None:
            return
        with suppress(Exception):
            await self._append_activity(rule, ActivityStatus.FAILED, (), reason)
        with suppress(Exception):
            await self._set_health(
                rule_id,
                RuleHealthStatus.NEEDS_ATTENTION,
                "runtime_error",
                reason,
            )

    async def _set_health(
        self,
        rule_id: str,
        status: RuleHealthStatus,
        code: str | None = None,
        message: str | None = None,
    ) -> None:
        current = await self._repository.get(rule_id)
        if current is None:
            return
        health = RuleHealth(
            status,
            () if status is RuleHealthStatus.HEALTHY else (
                HealthIssue(code or "runtime_degraded", message or "Runtime is degraded."),
            ),
        )
        if current.health == health:
            return
        try:
            updated = await self._repository.update(
                replace(current, health=health), expected_revision=current.revision
            )
        except (RevisionConflictError, RuleNotFoundError):
            return
        if updated.enabled and rule_id in self._rules:
            self._rules[rule_id] = updated

    @staticmethod
    def _skipped_result(skipped: SkippedDelivery) -> RecipientResult:
        recipient_id = skipped.recipient_id or "unresolved"
        return RecipientResult(
            recipient_id,
            skipped.recipient_id or "Unresolved audience",
            skipped.endpoint_id,
            None,
            RecipientResultStatus.SKIPPED,
            skipped.detail,
        )

    def _cooldown_remaining(self, rule: NotificationRule) -> int | None:
        seconds = rule.behaviour.cooldown_seconds
        last_delivery = self._last_delivery_at.get(rule.id)
        if seconds is None or last_delivery is None:
            return None
        eligible_at = last_delivery + timedelta(seconds=seconds)
        remaining = (eligible_at - self._now()).total_seconds()
        if remaining <= 0:
            return None
        return max(1, int(remaining + 0.999))

    @staticmethod
    def _trigger_state(rule: NotificationRule) -> str:
        parameters = rule.trigger.parameters
        if not isinstance(parameters, Mapping):
            raise ValueError("Trigger parameters must be an object")
        state = parameters.get("state")
        if not isinstance(state, str) or not state:
            raise ValueError("Binary trigger state must be a non-empty string")
        return state

    @staticmethod
    def _number_parameter(parameters: object, name: str) -> float:
        if not isinstance(parameters, Mapping):
            raise ValueError("Trigger parameters must be an object")
        value = parameters.get(name)
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
            raise ValueError(f"Trigger parameter {name!r} must be greater than zero")
        return float(value)

    @staticmethod
    def _trigger_summary(rule: NotificationRule) -> str:
        target = rule.trigger.target
        name = target.display_name_snapshot if target is not None else rule.name
        state = RuntimeManager._trigger_state(rule)
        if rule.trigger.type is TriggerType.BINARY_STATE_DURATION:
            duration = RuntimeManager._number_parameter(
                rule.trigger.parameters, "duration_seconds"
            )
            return f"{name} remained {state} for {duration:g} seconds"
        return f"{name} became {state}"

    def _now(self) -> datetime:
        value = self._clock()
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Runtime clock must return a timezone-aware datetime")
        return value.astimezone(UTC)


__all__ = ["DirectoryUsers", "RuntimeManager", "StateChangeCallback", "StateListener"]
