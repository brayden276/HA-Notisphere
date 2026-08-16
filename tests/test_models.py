from __future__ import annotations

import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta, timezone

import pytest

from custom_components.notification_manager.models import (
    ActivityRecord,
    ActivityStatus,
    Audience,
    AudienceType,
    ConditionSpec,
    ConditionType,
    DeliveryEndpoint,
    DeliveryPolicy,
    EndpointCapability,
    EndpointType,
    GroupType,
    NotificationAction,
    NotificationBehaviour,
    NotificationContent,
    NotificationRule,
    RecipientGroup,
    RecipientPreferences,
    RecipientProfile,
    RecipientResult,
    RecipientResultStatus,
    RuleScope,
    TargetRef,
    TriggerSpec,
    TriggerType,
    Urgency,
)

from .factories import NOW, make_rule


def test_rule_round_trip_covers_nested_contracts() -> None:
    target = TargetRef("person.brayden", "person", "Brayden")
    rule = replace(
        make_rule(),
        scope=RuleScope.PERSONAL,
        conditions=(
            ConditionSpec(ConditionType.PERSON_HOME, target, {"nested": {"allowed": True}}),
        ),
        audiences=(Audience(AudienceType.RECIPIENT, recipient_id="recipient-1"),),
        content=NotificationContent(
            "Garage",
            "The garage is open.",
            image_url="https://example.test/image.jpg",
            deep_link="/dashboard/garage",
            actions=(NotificationAction("open", "Open dashboard", "/dashboard/garage"),),
        ),
        delivery_policy=DeliveryPolicy(Urgency.CRITICAL, True, "alarm"),
        behaviour=NotificationBehaviour(60, 300, 120, 3, True, True),
        created_at=datetime(2026, 8, 15, 20, 0, tzinfo=timezone(timedelta(hours=10))),
    )

    encoded = rule.to_dict()
    json.dumps(encoded)
    decoded = NotificationRule.from_dict(encoded)

    assert decoded == rule
    assert decoded.created_at.tzinfo is UTC
    encoded["name"] = "Changed externally"
    encoded["conditions"][0]["parameters"]["nested"]["allowed"] = False  # type: ignore[index]
    assert decoded.name == "Garage open"
    assert decoded.conditions[0].parameters["nested"]["allowed"] is True


def test_recipient_group_and_activity_round_trip() -> None:
    endpoint = DeliveryEndpoint(
        id="phone-1",
        type=EndpointType.HA_NOTIFY,
        target="notify.mobile_app_phone",
        platform="mobile_app",
        capabilities=frozenset({EndpointCapability.TITLE, EndpointCapability.ACTIONS}),
        priority=1,
    )
    recipient = RecipientProfile(
        id="recipient-1",
        ha_user_id="user-1",
        person_entity_id="person.brayden",
        display_name="Brayden",
        endpoints=(endpoint,),
        preferences=RecipientPreferences("phone-1", True),
    )
    group = RecipientGroup("group-1", "Family", GroupType.CUSTOM, (recipient.id,))
    activity = ActivityRecord(
        id="activity-1",
        rule_id="rule-1",
        occurrence_id="occurrence-1",
        timestamp=NOW,
        trigger_summary="Garage remained open",
        status=ActivityStatus.SENT,
        recipient_results=(
            RecipientResult(
                recipient.id,
                recipient.display_name,
                endpoint.id,
                "Brayden's phone",
                RecipientResultStatus.SENT,
            ),
        ),
    )

    assert RecipientProfile.from_dict(recipient.to_dict()) == recipient
    assert RecipientGroup.from_dict(group.to_dict()) == group
    assert ActivityRecord.from_dict(activity.to_dict()) == activity


def test_parameter_input_is_deeply_frozen_and_output_is_fresh() -> None:
    source = {"values": [1, {"key": "original"}]}
    trigger = TriggerSpec(TriggerType.TIME, None, source)
    source["values"][1]["key"] = "mutated"  # type: ignore[index]
    first = trigger.to_dict()
    first["parameters"]["values"][1]["key"] = "also mutated"  # type: ignore[index]

    assert trigger.to_dict()["parameters"]["values"][1]["key"] == "original"  # type: ignore[index]


def test_naive_datetimes_are_rejected() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        replace(make_rule(), created_at=datetime(2026, 8, 15, 10, 0))
