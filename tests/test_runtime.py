from __future__ import annotations

import asyncio
from dataclasses import replace
from datetime import UTC, datetime, timedelta

from custom_components.notification_manager.manager import RequestUser
from custom_components.notification_manager.models import (
    ActivityStatus,
    Audience,
    AudienceType,
    ConditionSpec,
    ConditionType,
    DeliveryEndpoint,
    EndpointType,
    RecipientProfile,
    RecipientResultStatus,
    TargetRef,
    TriggerType,
)
from custom_components.notification_manager.recipients.manager import RecipientManager
from custom_components.notification_manager.runtime import (
    ConditionEvaluator,
    RuntimeManager,
    TimerManager,
)
from custom_components.notification_manager.storage import InMemoryStorageBackend, RuleRepository

from .factories import NOW, make_rule


def run(coroutine):  # type: ignore[no-untyped-def]
    return asyncio.run(coroutine)


class States:
    def __init__(self, values: dict[str, str] | None = None) -> None:
        self.values = values or {}

    def get_state(self, entity_id: str) -> str | None:
        return self.values.get(entity_id)


class ControlledSleep:
    def __init__(self) -> None:
        self.calls: list[tuple[float, asyncio.Future[None]]] = []

    async def __call__(self, delay: float) -> None:
        future = asyncio.get_running_loop().create_future()
        self.calls.append((delay, future))
        await future

    def release(self, index: int = -1) -> None:
        future = self.calls[index][1]
        if not future.done():
            future.set_result(None)


class RecordingDelivery:
    def __init__(self, failing_targets: set[str] | None = None) -> None:
        self.calls: list[str] = []
        self.failing_targets = failing_targets or set()

    async def async_send(  # type: ignore[no-untyped-def]
        self, endpoint, content, policy=None, *, replacement_key=None
    ) -> None:
        self.calls.append(endpoint.target)
        if endpoint.target in self.failing_targets:
            raise RuntimeError("phone offline")


class IndexedStateListener:
    def __init__(self) -> None:
        self.initial: tuple[str, ...] = ()
        self.updates: list[tuple[str, ...]] = []
        self.unsubscribed = False

    def async_listen(self, callback, entity_ids):  # type: ignore[no-untyped-def]
        self.initial = entity_ids

        def unsubscribe() -> None:
            self.unsubscribed = True

        return unsubscribe

    def async_update_entity_ids(self, entity_ids):  # type: ignore[no-untyped-def]
        self.updates.append(entity_ids)


def _recipient(identifier: str) -> RecipientProfile:
    return RecipientProfile(
        id=identifier,
        ha_user_id=f"user-{identifier}",
        display_name=identifier.title(),
        endpoints=(
            DeliveryEndpoint(
                id=f"endpoint-{identifier}",
                type=EndpointType.HA_NOTIFY,
                target=f"notify.mobile_app_{identifier}",
                platform="mobile_app",
            ),
        ),
    )


async def _runtime(
    rule,
    states: States,
    delivery: RecordingDelivery,
    *,
    sleep: ControlledSleep | None = None,
    recipients: tuple[RecipientProfile, ...] = (_recipient("alice"),),
):  # type: ignore[no-untyped-def]
    repository = RuleRepository(InMemoryStorageBackend(), clock=lambda: NOW)
    saved = await repository.create(rule)
    recipient_manager = RecipientManager(repository)
    await recipient_manager.replace_discovered_recipients(recipients)
    users = tuple(
        RequestUser(item.ha_user_id, item.ha_user_id == "user-alice")
        for item in recipients
    )

    async def directory() -> tuple[RequestUser, ...]:
        return users

    timers = TimerManager(sleep=sleep) if sleep is not None else TimerManager()
    runtime = RuntimeManager(
        repository,
        recipient_manager,
        delivery,
        states,
        directory,
        timers=timers,
        clock=lambda: datetime(2026, 8, 15, 10, 0, tzinfo=UTC),
        id_factory=iter(f"id-{index}" for index in range(100)).__next__,
    )
    await runtime.async_start()
    return repository, saved, runtime


def test_binary_state_fires_only_on_available_transition() -> None:
    async def scenario() -> None:
        rule = replace(
            make_rule(),
            owner_user_id="user-alice",
            trigger=replace(make_rule().trigger, type=TriggerType.BINARY_STATE),
            audiences=(Audience(AudienceType.EVERYONE),),
        )
        states = States({"binary_sensor.garage_door": "off"})
        delivery = RecordingDelivery()
        repository, _, runtime = await _runtime(rule, states, delivery)

        states.values["binary_sensor.garage_door"] = "on"
        await runtime.async_state_changed("binary_sensor.garage_door", "off", "on")
        await runtime.async_state_changed("binary_sensor.garage_door", "on", "on")
        await runtime.async_state_changed("binary_sensor.garage_door", "unknown", "on")

        assert delivery.calls == ["notify.mobile_app_alice"]
        assert (await repository.list_activity())[0].status is ActivityStatus.SENT

    run(scenario())


def test_runtime_subscribes_only_to_indexed_rule_entities_and_updates_incrementally() -> None:
    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend(), clock=lambda: NOW)
        saved = await repository.create(make_rule())
        recipients = RecipientManager(repository)
        listener = IndexedStateListener()

        async def directory() -> tuple[RequestUser, ...]:
            return ()

        runtime = RuntimeManager(
            repository,
            recipients,
            RecordingDelivery(),
            States(),
            directory,
            state_listener=listener,
        )
        await runtime.async_start()
        assert listener.initial == ("binary_sensor.garage_door",)

        disabled = replace(saved, enabled=False)
        await runtime.async_upsert_rule(disabled)
        assert listener.updates[-1] == ()

        await runtime.async_stop()
        assert listener.unsubscribed

    run(scenario())


def test_timer_generation_bookkeeping_is_released_after_cancel() -> None:
    async def scenario() -> None:
        sleep = ControlledSleep()
        timers = TimerManager(sleep=sleep)

        async def callback() -> None:
            return None

        timers.schedule("temporary-rule", 30, callback)
        await asyncio.sleep(0)
        assert timers.cancel_rule("temporary-rule")
        await asyncio.sleep(0)

        assert timers.pending_rule_ids == ()
        assert timers._generations == {}  # type: ignore[attr-defined]

    run(scenario())


def test_cooldown_skips_repeat_occurrence_until_window_expires() -> None:
    async def scenario() -> None:
        current = datetime(2026, 8, 15, 10, 0, tzinfo=UTC)

        def clock() -> datetime:
            return current

        rule = replace(
            make_rule(),
            owner_user_id="user-alice",
            trigger=replace(make_rule().trigger, type=TriggerType.BINARY_STATE),
            behaviour=replace(make_rule().behaviour, cooldown_seconds=60),
        )
        states = States({"binary_sensor.garage_door": "off"})
        delivery = RecordingDelivery()
        repository = RuleRepository(InMemoryStorageBackend(), clock=clock)
        saved = await repository.create(rule)
        recipients = RecipientManager(repository)
        await recipients.replace_discovered_recipients((_recipient("alice"),))

        async def directory() -> tuple[RequestUser, ...]:
            return (RequestUser("user-alice", True),)

        runtime = RuntimeManager(
            repository,
            recipients,
            delivery,
            states,
            directory,
            clock=clock,
            id_factory=iter(f"cooldown-{index}" for index in range(20)).__next__,
        )
        await runtime.async_start()
        states.values["binary_sensor.garage_door"] = "on"
        await runtime.async_state_changed("binary_sensor.garage_door", "off", "on")
        await runtime.async_state_changed("binary_sensor.garage_door", "off", "on")

        current = current + timedelta(seconds=60)
        await runtime.async_state_changed("binary_sensor.garage_door", "off", "on")

        activity = await repository.list_activity()
        assert delivery.calls == ["notify.mobile_app_alice", "notify.mobile_app_alice"]
        assert {item.status for item in activity} == {
            ActivityStatus.SENT,
            ActivityStatus.SKIPPED,
        }
        assert any(item.reason and "Cooldown active" in item.reason for item in activity)
        assert saved.id == rule.id

    run(scenario())


def test_duration_fires_after_current_state_and_never_backdates_restart() -> None:
    async def scenario() -> None:
        states = States({"binary_sensor.garage_door": "on"})
        sleep = ControlledSleep()
        delivery = RecordingDelivery()
        repository, _, runtime = await _runtime(
            replace(make_rule(), owner_user_id="user-alice"), states, delivery, sleep=sleep
        )
        await asyncio.sleep(0)

        assert sleep.calls[0][0] == 300
        assert delivery.calls == []
        sleep.release()
        for _ in range(10):
            if await repository.list_activity():
                break
            await asyncio.sleep(0)
        assert delivery.calls == ["notify.mobile_app_alice"]
        assert (await repository.list_activity())[0].trigger_summary.endswith("for 300 seconds")
        await runtime.async_stop()

    run(scenario())


def test_duration_rapid_flap_and_unavailable_cancel_pending_timer() -> None:
    async def scenario() -> None:
        states = States({"binary_sensor.garage_door": "off"})
        sleep = ControlledSleep()
        delivery = RecordingDelivery()
        _, _, runtime = await _runtime(
            replace(make_rule(), owner_user_id="user-alice"), states, delivery, sleep=sleep
        )
        states.values["binary_sensor.garage_door"] = "on"
        await runtime.async_state_changed("binary_sensor.garage_door", "off", "on")
        await asyncio.sleep(0)
        first = sleep.calls[-1][1]
        states.values["binary_sensor.garage_door"] = "off"
        await runtime.async_state_changed("binary_sensor.garage_door", "on", "off")
        assert first.cancelled()

        states.values["binary_sensor.garage_door"] = "on"
        await runtime.async_state_changed("binary_sensor.garage_door", "off", "on")
        await asyncio.sleep(0)
        second = sleep.calls[-1][1]
        states.values["binary_sensor.garage_door"] = "unavailable"
        await runtime.async_state_changed("binary_sensor.garage_door", "on", "unavailable")
        assert second.cancelled()
        assert delivery.calls == []

    run(scenario())


def test_disable_and_delete_cancel_pending_duration_timer() -> None:
    async def scenario() -> None:
        states = States({"binary_sensor.garage_door": "on"})
        sleep = ControlledSleep()
        delivery = RecordingDelivery()
        _, saved, runtime = await _runtime(
            replace(make_rule(), owner_user_id="user-alice"), states, delivery, sleep=sleep
        )
        await asyncio.sleep(0)
        first = sleep.calls[-1][1]
        await runtime.async_upsert_rule(replace(saved, enabled=False))
        assert first.cancelled()
        assert runtime.watchers.rule_ids == ()

        await runtime.async_upsert_rule(saved)
        await asyncio.sleep(0)
        second = sleep.calls[-1][1]
        await runtime.async_remove_rule(saved.id)
        assert second.cancelled()
        assert runtime.timers.pending_rule_ids == ()

    run(scenario())


def test_unavailable_condition_records_explicit_skip() -> None:
    async def scenario() -> None:
        person = TargetRef(
            "person.alice", "person", "Alice", registry_id="person-registry"
        )
        rule = replace(
            make_rule(),
            owner_user_id="user-alice",
            trigger=replace(make_rule().trigger, type=TriggerType.BINARY_STATE),
            conditions=(ConditionSpec(ConditionType.PERSON_HOME, person),),
        )
        states = States(
            {"binary_sensor.garage_door": "off", "person.alice": "unavailable"}
        )
        delivery = RecordingDelivery()
        repository, _, runtime = await _runtime(rule, states, delivery)
        states.values["binary_sensor.garage_door"] = "on"
        await runtime.async_state_changed("binary_sensor.garage_door", "off", "on")

        activity = (await repository.list_activity())[0]
        assert activity.status is ActivityStatus.SKIPPED
        assert activity.reason is not None and "unavailable" in activity.reason
        assert delivery.calls == []

    run(scenario())


def test_condition_evaluator_applies_all_supported_conditions_with_and_semantics() -> None:
    states = States(
        {
            "person.alice": "home",
            "person.bob": "work",
            "input_boolean.quiet_mode": "on",
        }
    )
    alice = TargetRef("person.alice", "person", "Alice")
    bob = TargetRef("person.bob", "person", "Bob")
    quiet_mode = TargetRef(
        "input_boolean.quiet_mode", "input_boolean", "Quiet mode"
    )
    evaluator = ConditionEvaluator(
        states, lambda: datetime(2026, 8, 15, 22, 30, tzinfo=UTC)
    )
    conditions = (
        ConditionSpec(ConditionType.PERSON_HOME, alice),
        ConditionSpec(ConditionType.PERSON_AWAY, bob),
        ConditionSpec(
            ConditionType.TIME_WINDOW, parameters={"start": "22:00", "end": "06:00"}
        ),
        ConditionSpec(ConditionType.ENTITY_STATE, quiet_mode, {"state": "on"}),
    )

    assert evaluator.evaluate(conditions).passed
    states.values["input_boolean.quiet_mode"] = "off"
    failed = evaluator.evaluate(conditions)
    assert not failed.passed
    assert failed.reason is not None and "Quiet mode" in failed.reason


def test_partial_delivery_records_each_recipient_result() -> None:
    async def scenario() -> None:
        rule = replace(
            make_rule(),
            owner_user_id="user-alice",
            trigger=replace(make_rule().trigger, type=TriggerType.BINARY_STATE),
        )
        states = States({"binary_sensor.garage_door": "off"})
        delivery = RecordingDelivery({"notify.mobile_app_bob"})
        repository, _, runtime = await _runtime(
            rule, states, delivery, recipients=(_recipient("alice"), _recipient("bob"))
        )
        states.values["binary_sensor.garage_door"] = "on"
        await runtime.async_state_changed("binary_sensor.garage_door", "off", "on")

        activity = (await repository.list_activity())[0]
        assert activity.status is ActivityStatus.PARTIAL
        assert {item.status for item in activity.recipient_results} == {
            RecipientResultStatus.SENT,
            RecipientResultStatus.FAILED,
        }
        assert activity.reason == "Sent to 1 recipient(s); 1 failed and 0 skipped."

    run(scenario())


def test_explicit_rule_test_bypasses_trigger_and_conditions_and_records_test() -> None:
    async def scenario() -> None:
        unavailable_person = TargetRef("person.alice", "person", "Alice")
        rule = replace(
            make_rule(),
            owner_user_id="user-alice",
            conditions=(
                ConditionSpec(ConditionType.PERSON_HOME, unavailable_person),
            ),
        )
        states = States({"binary_sensor.garage_door": "off"})
        delivery = RecordingDelivery()
        repository, saved, runtime = await _runtime(rule, states, delivery)

        record = await runtime.async_test_rule(saved)

        assert record.status is ActivityStatus.TEST
        assert record.trigger_summary == f"Test: {saved.name}"
        assert record.reason == "Test notification sent."
        assert delivery.calls == ["notify.mobile_app_alice"]
        assert (await repository.list_activity())[0] == record

    run(scenario())


def test_unsaved_rule_test_returns_result_without_persisting_activity() -> None:
    async def scenario() -> None:
        rule = replace(make_rule(), owner_user_id="user-alice")
        states = States({"binary_sensor.garage_door": "off"})
        delivery = RecordingDelivery()
        repository, saved, runtime = await _runtime(rule, states, delivery)

        record = await runtime.async_test_rule(saved, persist_activity=False)

        assert record.status is ActivityStatus.TEST
        assert delivery.calls == ["notify.mobile_app_alice"]
        assert await repository.list_activity() == ()

    run(scenario())


def test_reload_rebuilds_shared_index_and_restarts_duration_timing() -> None:
    async def scenario() -> None:
        states = States({"binary_sensor.garage_door": "on"})
        sleep = ControlledSleep()
        delivery = RecordingDelivery()
        repository, saved, runtime = await _runtime(
            replace(make_rule(), owner_user_id="user-alice"), states, delivery, sleep=sleep
        )
        await asyncio.sleep(0)
        original = sleep.calls[-1][1]
        updated = await repository.update(
            replace(saved, name="Reloaded"), expected_revision=saved.revision
        )
        await runtime.async_reload()
        await asyncio.sleep(0)

        assert original.cancelled()
        assert runtime.watchers.entity_ids == ("binary_sensor.garage_door",)
        assert runtime.watchers.rule_ids_for("binary_sensor.garage_door") == (updated.id,)
        assert len(sleep.calls) == 2

    run(scenario())
