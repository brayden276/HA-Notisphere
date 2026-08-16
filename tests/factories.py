"""Small valid domain factories shared by focused tests."""

from __future__ import annotations

from datetime import UTC, datetime

from custom_components.notification_manager.models import (
    Audience,
    AudienceType,
    DeliveryPolicy,
    NotificationBehaviour,
    NotificationContent,
    NotificationRule,
    RuleHealth,
    RuleScope,
    TargetRef,
    TriggerSpec,
    TriggerType,
)

NOW = datetime(2026, 8, 15, 10, 0, tzinfo=UTC)


def make_rule(rule_id: str = "rule-1", *, name: str = "Garage open") -> NotificationRule:
    target = TargetRef(
        entity_id="binary_sensor.garage_door",
        registry_id="registry-1",
        device_id="device-1",
        domain="binary_sensor",
        device_class="garage_door",
        display_name_snapshot="Garage Door",
    )
    return NotificationRule(
        id=rule_id,
        revision=0,
        name=name,
        enabled=True,
        owner_user_id="user-1",
        scope=RuleScope.HOUSEHOLD,
        trigger=TriggerSpec(
            type=TriggerType.BINARY_STATE_DURATION,
            target=target,
            parameters={"state": "on", "duration_seconds": 300},
        ),
        conditions=(),
        audiences=(Audience(AudienceType.EVERYONE),),
        content=NotificationContent(title="Garage door", message="Open for five minutes."),
        delivery_policy=DeliveryPolicy(),
        behaviour=NotificationBehaviour(),
        health=RuleHealth(),
        created_at=NOW,
        updated_at=NOW,
    )
