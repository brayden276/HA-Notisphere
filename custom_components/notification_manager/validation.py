"""Structured validation for version-one domain contracts."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import time

from .models import (
    RULE_SCHEMA_VERSION,
    AudienceType,
    ConditionSpec,
    ConditionType,
    GroupType,
    NotificationRule,
    RecipientGroup,
    RecipientProfile,
    RuleHealthStatus,
    TargetRef,
    TriggerType,
    Urgency,
)


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    """One machine-addressable validation issue."""

    path: str
    code: str
    message: str


class DomainValidationError(ValueError):
    """Raised when a domain object violates its versioned contract."""

    def __init__(self, issues: Iterable[ValidationIssue]) -> None:
        self.issues = tuple(issues)
        summary = "; ".join(f"{issue.path}: {issue.message}" for issue in self.issues)
        super().__init__(summary)


def _required_text(value: str, path: str, issues: list[ValidationIssue]) -> None:
    if not value.strip():
        issues.append(ValidationIssue(path, "required", "Must not be empty."))


def _parameter(parameters: object, name: str) -> object:
    if not isinstance(parameters, Mapping):
        return None
    return parameters.get(name)


def _positive_parameter(
    parameters: object,
    name: str,
    path: str,
    issues: list[ValidationIssue],
) -> None:
    if not isinstance(parameters, Mapping):
        issues.append(ValidationIssue(path, "invalid_type", "Must be an object."))
        return
    value = parameters.get(name)
    if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
        issues.append(ValidationIssue(path, "positive_number", "Must be greater than zero."))


def _validate_target(
    target: TargetRef | None,
    path: str,
    issues: list[ValidationIssue],
    *,
    required: bool,
) -> None:
    if target is None:
        if required:
            issues.append(ValidationIssue(path, "required", "A target is required."))
        return
    entity_id = target.entity_id
    domain = target.domain
    display_name = target.display_name_snapshot
    _required_text(entity_id, f"{path}.entity_id", issues)
    _required_text(domain, f"{path}.domain", issues)
    _required_text(display_name, f"{path}.display_name_snapshot", issues)
    if "." not in entity_id or entity_id.split(".", 1)[0] != domain:
        issues.append(
            ValidationIssue(
                f"{path}.domain",
                "domain_mismatch",
                "Must match the entity ID domain.",
            )
        )


def _validate_condition(condition: ConditionSpec, index: int) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    path = f"conditions[{index}]"
    target_required = condition.type is not ConditionType.TIME_WINDOW
    _validate_target(condition.target, f"{path}.target", issues, required=target_required)

    if condition.type is ConditionType.TIME_WINDOW:
        parameters = condition.parameters
        start = _parameter(parameters, "start")
        end = _parameter(parameters, "end")
        for key, value in (("start", start), ("end", end)):
            if not isinstance(value, str):
                issues.append(
                    ValidationIssue(f"{path}.parameters.{key}", "required", "A time is required.")
                )
                continue
            try:
                time.fromisoformat(value)
            except ValueError:
                issues.append(
                    ValidationIssue(
                        f"{path}.parameters.{key}",
                        "invalid_time",
                        "Must be an ISO local time.",
                    )
                )
    elif condition.type is ConditionType.ENTITY_STATE:
        state = _parameter(condition.parameters, "state")
        if not isinstance(state, str) or not state:
            issues.append(
                ValidationIssue(
                    f"{path}.parameters.state",
                    "required",
                    "A target state is required.",
                )
            )
    return issues


def validate_rule(rule: NotificationRule) -> tuple[ValidationIssue, ...]:
    """Return all v1 rule validation issues without mutating the rule."""

    issues: list[ValidationIssue] = []
    if rule.schema_version != RULE_SCHEMA_VERSION:
        issues.append(
            ValidationIssue(
                "schema_version",
                "unsupported_schema",
                f"Expected schema version {RULE_SCHEMA_VERSION}.",
            )
        )
    _required_text(rule.id, "id", issues)
    _required_text(rule.name, "name", issues)
    _required_text(rule.owner_user_id, "owner_user_id", issues)
    if rule.revision < 0:
        issues.append(ValidationIssue("revision", "minimum", "Must be zero or greater."))
    if rule.updated_at < rule.created_at:
        issues.append(ValidationIssue("updated_at", "chronology", "Must not be before created_at."))

    trigger_requires_target = rule.trigger.type is not TriggerType.TIME
    _validate_target(
        rule.trigger.target, "trigger.target", issues, required=trigger_requires_target
    )
    if rule.trigger.type is TriggerType.BINARY_STATE_DURATION:
        _positive_parameter(
            rule.trigger.parameters,
            "duration_seconds",
            "trigger.parameters.duration_seconds",
            issues,
        )
    elif rule.trigger.type is TriggerType.NUMERIC_THRESHOLD:
        threshold = _parameter(rule.trigger.parameters, "threshold")
        if not isinstance(threshold, (int, float)) or isinstance(threshold, bool):
            issues.append(
                ValidationIssue(
                    "trigger.parameters.threshold",
                    "number_required",
                    "A numeric threshold is required.",
                )
            )
        direction = _parameter(rule.trigger.parameters, "direction")
        if direction not in {"ABOVE", "BELOW"}:
            issues.append(
                ValidationIssue(
                    "trigger.parameters.direction",
                    "invalid_choice",
                    "Must be ABOVE or BELOW.",
                )
            )
    elif rule.trigger.type is TriggerType.TIME:
        at = _parameter(rule.trigger.parameters, "at")
        if not isinstance(at, str):
            issues.append(
                ValidationIssue("trigger.parameters.at", "required", "A local time is required.")
            )
        else:
            try:
                time.fromisoformat(at)
            except ValueError:
                issues.append(
                    ValidationIssue(
                        "trigger.parameters.at",
                        "invalid_time",
                        "Must be an ISO local time.",
                    )
                )

    for index, condition in enumerate(rule.conditions):
        issues.extend(_validate_condition(condition, index))

    if not rule.audiences:
        issues.append(
            ValidationIssue("audiences", "required", "At least one audience is required.")
        )
    for index, audience in enumerate(rule.audiences):
        path = f"audiences[{index}]"
        if audience.type is AudienceType.RECIPIENT:
            if not audience.recipient_id:
                issues.append(
                    ValidationIssue(f"{path}.recipient_id", "required", "A recipient is required.")
                )
            if audience.group_id is not None:
                issues.append(
                    ValidationIssue(f"{path}.group_id", "not_allowed", "Must not be set.")
                )
        elif audience.type is AudienceType.GROUP:
            if not audience.group_id:
                issues.append(
                    ValidationIssue(f"{path}.group_id", "required", "A group is required.")
                )
            if audience.recipient_id is not None:
                issues.append(
                    ValidationIssue(f"{path}.recipient_id", "not_allowed", "Must not be set.")
                )
        elif audience.recipient_id is not None or audience.group_id is not None:
            issues.append(
                ValidationIssue(path, "unexpected_reference", "This audience takes no reference.")
            )

    _required_text(rule.content.title, "content.title", issues)
    _required_text(rule.content.message, "content.message", issues)
    action_ids: set[str] = set()
    for index, action in enumerate(rule.content.actions):
        _required_text(action.id, f"content.actions[{index}].id", issues)
        _required_text(action.title, f"content.actions[{index}].title", issues)
        if action.id in action_ids:
            issues.append(
                ValidationIssue(f"content.actions[{index}].id", "duplicate", "Must be unique.")
            )
        action_ids.add(action.id)

    behaviour_values = {
        "cooldown_seconds": rule.behaviour.cooldown_seconds,
        "reminder_after_seconds": rule.behaviour.reminder_after_seconds,
        "repeat_every_seconds": rule.behaviour.repeat_every_seconds,
        "max_repeats": rule.behaviour.max_repeats,
    }
    for name, value in behaviour_values.items():
        if value is not None and value <= 0:
            issues.append(
                ValidationIssue(
                    f"behaviour.{name}", "positive_integer", "Must be greater than zero."
                )
            )
    if rule.behaviour.max_repeats is not None and rule.behaviour.repeat_every_seconds is None:
        issues.append(
            ValidationIssue(
                "behaviour.max_repeats",
                "requires_repeat_interval",
                "Requires repeat_every_seconds.",
            )
        )
    if rule.delivery_policy.urgency is Urgency.CRITICAL and not rule.delivery_policy.sound:
        issues.append(
            ValidationIssue(
                "delivery_policy.sound",
                "required_for_critical",
                "Critical notifications require a sound.",
            )
        )
    if rule.health.status is RuleHealthStatus.HEALTHY and rule.health.issues:
        issues.append(
            ValidationIssue("health.issues", "inconsistent", "Healthy rules cannot have issues.")
        )
    if rule.health.status is not RuleHealthStatus.HEALTHY and not rule.health.issues:
        issues.append(
            ValidationIssue("health.issues", "required", "Unhealthy rules require an issue.")
        )
    return tuple(issues)


def validate_recipient(recipient: RecipientProfile) -> tuple[ValidationIssue, ...]:
    issues: list[ValidationIssue] = []
    _required_text(recipient.id, "id", issues)
    _required_text(recipient.ha_user_id, "ha_user_id", issues)
    _required_text(recipient.display_name, "display_name", issues)
    endpoint_ids: set[str] = set()
    for index, endpoint in enumerate(recipient.endpoints):
        path = f"endpoints[{index}]"
        _required_text(endpoint.id, f"{path}.id", issues)
        _required_text(endpoint.target, f"{path}.target", issues)
        _required_text(endpoint.platform, f"{path}.platform", issues)
        if endpoint.priority < 0:
            issues.append(ValidationIssue(f"{path}.priority", "minimum", "Must be non-negative."))
        if endpoint.id in endpoint_ids:
            issues.append(ValidationIssue(f"{path}.id", "duplicate", "Must be unique."))
        endpoint_ids.add(endpoint.id)
    preferred = recipient.preferences.preferred_endpoint_id
    if preferred is not None and preferred not in endpoint_ids:
        issues.append(
            ValidationIssue(
                "preferences.preferred_endpoint_id",
                "unknown_endpoint",
                "Must refer to an endpoint on this recipient.",
            )
        )
    return tuple(issues)


def validate_group(group: RecipientGroup) -> tuple[ValidationIssue, ...]:
    issues: list[ValidationIssue] = []
    _required_text(group.id, "id", issues)
    _required_text(group.name, "name", issues)
    if len(set(group.member_recipient_ids)) != len(group.member_recipient_ids):
        issues.append(
            ValidationIssue("member_recipient_ids", "duplicate", "Members must be unique.")
        )
    if group.type is GroupType.SYSTEM:
        if group.system_type is None:
            issues.append(ValidationIssue("system_type", "required", "A system type is required."))
        if group.member_recipient_ids:
            issues.append(
                ValidationIssue(
                    "member_recipient_ids",
                    "dynamic_membership",
                    "System group membership is resolved dynamically.",
                )
            )
    elif group.system_type is not None:
        issues.append(
            ValidationIssue(
                "system_type", "not_allowed", "Custom groups cannot have a system type."
            )
        )
    return tuple(issues)


def require_valid_rule(rule: NotificationRule) -> None:
    """Raise ``DomainValidationError`` if ``rule`` is invalid."""

    issues = validate_rule(rule)
    if issues:
        raise DomainValidationError(issues)


def require_valid_recipient(recipient: RecipientProfile) -> None:
    issues = validate_recipient(recipient)
    if issues:
        raise DomainValidationError(issues)


def require_valid_group(group: RecipientGroup) -> None:
    issues = validate_group(group)
    if issues:
        raise DomainValidationError(issues)


__all__ = [
    "DomainValidationError",
    "ValidationIssue",
    "require_valid_group",
    "require_valid_recipient",
    "require_valid_rule",
    "validate_group",
    "validate_recipient",
    "validate_rule",
]
