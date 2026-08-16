from __future__ import annotations

import asyncio
from dataclasses import replace
from types import SimpleNamespace

from custom_components.notification_manager.health import (
    HealthEntitySnapshot,
    HealthUserSnapshot,
    HomeAssistantRuleHealthAdapter,
    RuleHealthReconciler,
    RuleHealthReconciliationService,
    RuleHealthSnapshot,
)
from custom_components.notification_manager.health.coordinator import (
    HomeAssistantRuleHealthCoordinator,
)
from custom_components.notification_manager.models import (
    Audience,
    AudienceType,
    ConditionSpec,
    ConditionType,
    DeliveryEndpoint,
    EndpointType,
    RecipientProfile,
    RuleHealthStatus,
    TargetRef,
)
from custom_components.notification_manager.storage import (
    InMemoryStorageBackend,
    RevisionConflictError,
    RuleRepository,
)
from tests.factories import make_rule


def run(coroutine):  # type: ignore[no-untyped-def]
    return asyncio.run(coroutine)


def entity(
    entity_id: str = "binary_sensor.garage_door",
    *,
    registry_id: str | None = "registry-1",
    available: bool = True,
) -> HealthEntitySnapshot:
    return HealthEntitySnapshot(entity_id, registry_id, available)


def recipient(
    recipient_id: str = "recipient-1",
    user_id: str = "user-1",
    *,
    usable: bool = True,
) -> RecipientProfile:
    endpoints = (
        DeliveryEndpoint(
            f"endpoint-{recipient_id}",
            EndpointType.HA_NOTIFY,
            f"notify.mobile_app_{recipient_id}",
            "mobile_app",
        ),
    ) if usable else ()
    return RecipientProfile(recipient_id, user_id, recipient_id.title(), endpoints)


def snapshot(
    *entities: HealthEntitySnapshot,
    recipients: tuple[RecipientProfile, ...] | None = None,
) -> RuleHealthSnapshot:
    return RuleHealthSnapshot(
        entities,
        recipients if recipients is not None else (recipient(),),
        (),
        (HealthUserSnapshot("user-1", True),),
    )


def test_stable_registry_id_repairs_an_entity_rename_without_changing_identity() -> None:
    rule = make_rule()
    renamed = entity("binary_sensor.garage_entry")

    reconciled = RuleHealthReconciler().reconcile(rule, snapshot(renamed))

    assert reconciled.trigger.target is not None
    assert reconciled.trigger.target.entity_id == "binary_sensor.garage_entry"
    assert reconciled.trigger.target.registry_id == "registry-1"
    assert reconciled.trigger.target.display_name_snapshot == "Garage Door"
    assert reconciled.health.status is RuleHealthStatus.HEALTHY
    assert reconciled.health.issues == ()


def test_deleted_primary_trigger_needs_attention_without_entity_substitution() -> None:
    rule = make_rule()
    unrelated = entity(
        "binary_sensor.garage_replacement",
        registry_id="different-registry-id",
    )

    reconciled = RuleHealthReconciler().reconcile(rule, snapshot(unrelated))

    assert reconciled.trigger.target == rule.trigger.target
    assert reconciled.health.status is RuleHealthStatus.NEEDS_ATTENTION
    assert reconciled.health.issues[0].code == "health_trigger_missing"
    assert "Choose the trigger device again" in reconciled.health.issues[0].message


def test_unavailable_primary_trigger_is_degraded_and_not_satisfiable() -> None:
    reconciled = RuleHealthReconciler().reconcile(
        make_rule(), snapshot(entity(available=False))
    )

    assert reconciled.health.status is RuleHealthStatus.DEGRADED
    issue = reconciled.health.issues[0]
    assert issue.code == "health_trigger_unavailable"
    assert "cannot currently be satisfied" in issue.message


def test_condition_rename_is_repaired_and_unavailability_has_a_human_issue() -> None:
    condition_target = TargetRef(
        entity_id="person.alice_old",
        registry_id="registry-person",
        device_id=None,
        domain="person",
        device_class=None,
        display_name_snapshot="Alice",
    )
    rule = replace(
        make_rule(),
        conditions=(ConditionSpec(ConditionType.PERSON_HOME, condition_target),),
    )

    reconciled = RuleHealthReconciler().reconcile(
        rule,
        snapshot(
            entity(),
            entity("person.alice", registry_id="registry-person", available=False),
        ),
    )

    assert reconciled.conditions[0].target is not None
    assert reconciled.conditions[0].target.entity_id == "person.alice"
    assert reconciled.health.status is RuleHealthStatus.DEGRADED
    condition_issue = next(
        issue
        for issue in reconciled.health.issues
        if issue.code == "health_condition_unavailable"
    )
    assert condition_issue.message == (
        "Condition 1 cannot be checked because Alice is unavailable."
    )


def test_lost_recipient_endpoints_degrade_partial_and_empty_audiences() -> None:
    rule = replace(
        make_rule(),
        audiences=(
            Audience(AudienceType.RECIPIENT, recipient_id="recipient-1"),
            Audience(AudienceType.RECIPIENT, recipient_id="recipient-2"),
        ),
    )
    partial = snapshot(
        entity(),
        recipients=(recipient(), recipient("recipient-2", "user-2", usable=False)),
    )

    partial_rule = RuleHealthReconciler().reconcile(rule, partial)
    empty_rule = RuleHealthReconciler().reconcile(
        rule,
        snapshot(
            entity(),
            recipients=(
                recipient(usable=False),
                recipient("recipient-2", "user-2", usable=False),
            ),
        ),
    )

    assert partial_rule.health.status is RuleHealthStatus.DEGRADED
    assert partial_rule.health.issues[-1].code == "health_audience_partial"
    assert empty_rule.health.status is RuleHealthStatus.DEGRADED
    assert empty_rule.health.issues[-1].code == "health_audience_unavailable"


def test_persistence_retries_from_latest_revision_and_preserves_concurrent_edits() -> None:
    class ConflictOnceRepository(RuleRepository):
        def __init__(self) -> None:
            super().__init__(InMemoryStorageBackend())
            self.conflicted = False

        async def update(self, rule, *, expected_revision):  # type: ignore[no-untyped-def]
            if not self.conflicted:
                self.conflicted = True
                current = await self.get(rule.id)
                assert current is not None
                await super().update(
                    replace(current, name="Edited while reconciling"),
                    expected_revision=current.revision,
                )
                raise RevisionConflictError(rule.id, expected_revision, current.revision + 1)
            return await super().update(rule, expected_revision=expected_revision)

    async def scenario() -> None:
        repository = ConflictOnceRepository()
        await repository.create(make_rule())
        service = RuleHealthReconciliationService(repository)

        report = await service.async_reconcile(
            snapshot(entity("binary_sensor.garage_entry"))
        )

        assert len(report.updated_rules) == 1
        saved = report.updated_rules[0]
        assert saved.name == "Edited while reconciling"
        assert saved.trigger.target is not None
        assert saved.trigger.target.entity_id == "binary_sensor.garage_entry"
        assert report.conflicted_rule_ids == ()

    run(scenario())


def test_home_assistant_adapter_cache_requires_explicit_invalidation() -> None:
    class FakeAdapter(HomeAssistantRuleHealthAdapter):
        def __init__(self) -> None:
            super().__init__(object())
            self.calls = 0

        def _snapshots(self) -> tuple[HealthEntitySnapshot, ...]:
            self.calls += 1
            return (entity(),)

    async def scenario() -> None:
        adapter = FakeAdapter()
        await adapter.async_snapshot((recipient(),), (), (HealthUserSnapshot("user-1"),))
        await adapter.async_snapshot((recipient(),), (), (HealthUserSnapshot("user-1"),))
        assert adapter.calls == 1
        adapter.invalidate()
        await adapter.async_snapshot((recipient(),), (), (HealthUserSnapshot("user-1"),))
        assert adapter.calls == 2

    run(scenario())


def test_health_events_ignore_normal_state_changes_and_reconcile_availability() -> None:
    class RecordingCoordinator(HomeAssistantRuleHealthCoordinator):
        def __init__(self) -> None:
            self.invalidations = 0
            self.requests = 0
            super().__init__(
                object(),
                RuleRepository(InMemoryStorageBackend()),
                SimpleNamespace(),
                invalidate_capabilities=self._invalidate,
            )
            self._tracked_entity_ids = frozenset({"binary_sensor.garage_door"})

        def _invalidate(self) -> None:
            self.invalidations += 1

        def request_reconciliation(self) -> None:
            self.requests += 1

    def state(value: str, **attributes: object) -> SimpleNamespace:
        return SimpleNamespace(state=value, attributes=attributes)

    coordinator = RecordingCoordinator()
    coordinator._state_changed(
        SimpleNamespace(
            data={
                "entity_id": "binary_sensor.garage_door",
                "old_state": state("off", friendly_name="Garage Door"),
                "new_state": state("on", friendly_name="Garage Door"),
            }
        )
    )
    assert coordinator.requests == 0
    assert coordinator.invalidations == 0

    coordinator._state_changed(
        SimpleNamespace(
            data={
                "entity_id": "binary_sensor.garage_door",
                "old_state": state("on", friendly_name="Garage Door"),
                "new_state": state("unavailable", friendly_name="Garage Door"),
            }
        )
    )
    assert coordinator.requests == 1
    assert coordinator.invalidations == 1

    coordinator._state_changed(
        SimpleNamespace(
            data={
                "entity_id": "binary_sensor.garage_door",
                "old_state": state("unavailable", friendly_name="Garage Door"),
                "new_state": state("unavailable", friendly_name="Main Garage Door"),
            }
        )
    )
    assert coordinator.requests == 1
    assert coordinator.invalidations == 2
