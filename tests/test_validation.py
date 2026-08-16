from __future__ import annotations

from dataclasses import replace

import pytest

from custom_components.notification_manager.models import (
    Audience,
    AudienceType,
    DeliveryPolicy,
    NotificationBehaviour,
    NotificationContent,
    RuleHealth,
    RuleHealthStatus,
    TriggerSpec,
    TriggerType,
    Urgency,
)
from custom_components.notification_manager.validation import (
    DomainValidationError,
    require_valid_rule,
    validate_rule,
)

from .factories import make_rule


def test_valid_v1_rule_has_no_issues() -> None:
    assert validate_rule(make_rule()) == ()


def test_validation_returns_multiple_structured_issues() -> None:
    rule = replace(
        make_rule(),
        name=" ",
        audiences=(Audience(AudienceType.RECIPIENT),),
        content=NotificationContent("", ""),
        delivery_policy=DeliveryPolicy(Urgency.CRITICAL),
        behaviour=NotificationBehaviour(max_repeats=2),
        health=RuleHealth(RuleHealthStatus.DEGRADED),
    )

    issues = validate_rule(rule)
    paths = {issue.path for issue in issues}

    assert {
        "name",
        "audiences[0].recipient_id",
        "content.title",
        "content.message",
        "delivery_policy.sound",
        "behaviour.max_repeats",
        "health.issues",
    } <= paths
    assert all(issue.code and issue.message for issue in issues)

    with pytest.raises(DomainValidationError) as error:
        require_valid_rule(rule)
    assert error.value.issues == issues


def test_trigger_specific_validation() -> None:
    rule = replace(
        make_rule(),
        trigger=TriggerSpec(
            TriggerType.NUMERIC_THRESHOLD,
            make_rule().trigger.target,
            {"threshold": "hot", "direction": "SIDEWAYS"},
        ),
    )

    codes = {(issue.path, issue.code) for issue in validate_rule(rule)}
    assert ("trigger.parameters.threshold", "number_required") in codes
    assert ("trigger.parameters.direction", "invalid_choice") in codes
