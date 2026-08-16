from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta

import pytest

from custom_components.notification_manager.manager import (
    PermissionDeniedError,
    RequestUser,
)
from custom_components.notification_manager.models import (
    ActivityRecord,
    ActivityStatus,
    DeliveryEndpoint,
    EndpointType,
    HealthIssue,
    RecipientProfile,
    RecipientResult,
    RecipientResultStatus,
    RuleHealth,
    RuleHealthStatus,
    RuleScope,
)
from custom_components.notification_manager.observability import ObservabilityService
from custom_components.notification_manager.storage import (
    ACTIVITY_RETENTION_PREFERENCES_KEY,
    ActivityRetentionSettings,
    InMemoryStorageBackend,
    RuleRepository,
)

from .factories import make_rule


def run(coroutine):  # type: ignore[no-untyped-def]
    return asyncio.run(coroutine)


def activity(
    identifier: str,
    rule_id: str,
    *,
    status: ActivityStatus = ActivityStatus.SENT,
    recipient_id: str = "recipient-1",
    timestamp: datetime = datetime(2026, 8, 16, 10, 0, tzinfo=UTC),
    reason: str | None = None,
) -> ActivityRecord:
    return ActivityRecord(
        id=identifier,
        rule_id=rule_id,
        occurrence_id=f"occurrence-{identifier}",
        timestamp=timestamp,
        trigger_summary="Garage Door remained open for 5 minutes",
        status=status,
        recipient_results=(
            RecipientResult(
                recipient_id=recipient_id,
                recipient_name="Household member",
                endpoint_id="endpoint-1",
                endpoint_name="Primary phone",
                status=(
                    RecipientResultStatus.SENT
                    if status is ActivityStatus.SENT
                    else RecipientResultStatus.SKIPPED
                ),
                reason=reason,
            ),
        ),
        reason=reason,
    )


def test_activity_is_permission_filtered_and_supports_all_filters() -> None:
    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend())
        own = await repository.create(
            replace(
                make_rule("own"),
                owner_user_id="user-1",
                scope=RuleScope.PERSONAL,
            )
        )
        other = await repository.create(
            replace(
                make_rule("other"),
                owner_user_id="user-2",
                scope=RuleScope.PERSONAL,
            )
        )
        household = await repository.create(make_rule("household"))
        expected_reason = "Skipped because the recipient has no enabled endpoint."
        await repository.append_activity(activity("own-sent", own.id))
        await repository.append_activity(
            activity(
                "own-skipped",
                own.id,
                status=ActivityStatus.SKIPPED,
                recipient_id="recipient-2",
                reason=expected_reason,
            )
        )
        await repository.append_activity(activity("other", other.id))
        await repository.append_activity(activity("household", household.id))

        service = ObservabilityService(repository, version="0.1.0")
        ordinary = RequestUser("user-1", False)
        admin = RequestUser("admin", True)

        assert {item.id for item in await service.list_activity(ordinary)} == {
            "own-sent",
            "own-skipped",
        }
        filtered = await service.list_activity(
            ordinary,
            rule_id=own.id,
            recipient_id="recipient-2",
            status=ActivityStatus.SKIPPED,
        )
        assert [item.id for item in filtered] == ["own-skipped"]
        assert filtered[0].reason == expected_reason
        assert len(await service.list_activity(admin)) == 4

    run(scenario())


def test_settings_are_admin_only_versioned_persistent_and_prune_immediately() -> None:
    async def scenario() -> None:
        now = datetime(2026, 8, 16, 10, 0, tzinfo=UTC)
        backend = InMemoryStorageBackend()
        repository = RuleRepository(backend, clock=lambda: now)
        service = ObservabilityService(repository, version="0.1.0")
        admin = RequestUser("admin", True)
        ordinary = RequestUser("user-1", False)
        await repository.append_activity(activity("recent-1", "rule", timestamp=now))
        await repository.append_activity(
            activity("recent-2", "rule", timestamp=now - timedelta(minutes=1))
        )
        await repository.append_activity(
            activity("old", "rule", timestamp=now - timedelta(days=2))
        )

        with pytest.raises(PermissionDeniedError):
            await service.get_settings(ordinary)
        with pytest.raises(PermissionDeniedError):
            await service.update_settings(
                ordinary,
                activity_retention_days=1,
                activity_retention_records=1,
            )
        with pytest.raises(ValueError):
            await service.update_settings(
                admin,
                activity_retention_days=0,
                activity_retention_records=1,
            )
        with pytest.raises(ValueError):
            await service.update_settings(
                admin,
                activity_retention_days=30,
                activity_retention_records=1_001,
            )

        settings = await service.update_settings(
            admin,
            activity_retention_days=1,
            activity_retention_records=1,
        )
        assert settings == ActivityRetentionSettings(days=1, records=1)
        assert [item.id for item in await repository.list_activity()] == ["recent-1"]
        raw = await backend.load()
        assert raw is not None
        assert raw["preferences"][ACTIVITY_RETENTION_PREFERENCES_KEY] == {  # type: ignore[index]
            "schema_version": 1,
            "days": 1,
            "records": 1,
        }

        reloaded = RuleRepository(backend, clock=lambda: now)
        assert await reloaded.activity_retention_settings() == settings

    run(scenario())


def test_malformed_retention_preferences_fall_back_to_safe_defaults() -> None:
    async def scenario() -> None:
        initial = {
            "schema_version": 1,
            "rules": [],
            "recipients": [],
            "groups": [],
            "activity": [],
            "preferences": {
                ACTIVITY_RETENTION_PREFERENCES_KEY: {
                    "schema_version": 999,
                    "days": "forever",
                    "records": -1,
                }
            },
        }
        repository = RuleRepository(InMemoryStorageBackend(initial))
        assert await repository.activity_retention_settings() == ActivityRetentionSettings()

    run(scenario())


@dataclass(frozen=True, slots=True)
class FakeWatchers:
    rule_ids: tuple[str, ...]
    entity_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class FakeTimers:
    pending_rule_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class FakeRuntime:
    watchers: FakeWatchers
    timers: FakeTimers


def test_admin_diagnostics_are_aggregate_and_payload_safe() -> None:
    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend())
        await repository.create(make_rule("healthy"))
        await repository.create(
            replace(
                make_rule("degraded"),
                enabled=False,
                health=RuleHealth(
                    RuleHealthStatus.DEGRADED,
                    (HealthIssue("missing_endpoint", "A recipient endpoint is unavailable."),),
                ),
            )
        )
        await repository.replace_recipients(
            (
                RecipientProfile(
                    id="recipient-1",
                    ha_user_id="user-1",
                    display_name="Household member",
                    endpoints=(
                        DeliveryEndpoint(
                            id="endpoint-1",
                            type=EndpointType.HA_NOTIFY,
                            target="notify.secret_phone_target",
                            platform="mobile_app",
                        ),
                        DeliveryEndpoint(
                            id="endpoint-2",
                            type=EndpointType.HA_NOTIFY,
                            target="notify.disabled_secret_target",
                            platform="mobile_app",
                            enabled=False,
                        ),
                    ),
                ),
            )
        )
        await repository.append_activity(activity("activity-1", "healthy"))
        runtime = FakeRuntime(
            FakeWatchers(("healthy",), ("binary_sensor.garage",)),
            FakeTimers(("healthy",)),
        )
        service = ObservabilityService(repository, version="0.1.0", runtime=runtime)

        with pytest.raises(PermissionDeniedError):
            await service.diagnostics(RequestUser("user-1", False))
        result = (await service.diagnostics(RequestUser("admin", True))).to_dict()
        assert result["version"] == "0.1.0"
        assert result["rules"] == {
            "total": 2,
            "enabled": 1,
            "health": {"HEALTHY": 1, "DEGRADED": 1, "NEEDS_ATTENTION": 0},
        }
        assert result["discovery"] == {
            "recipients": 1,
            "endpoints": 2,
            "enabled_endpoints": 1,
        }
        assert result["runtime"] == {
            "attached": True,
            "watched_rules": 1,
            "watched_entities": 1,
            "pending_timers": 1,
        }
        serialised = repr(result)
        assert "secret_phone_target" not in serialised
        assert "Garage door" not in serialised

    run(scenario())
