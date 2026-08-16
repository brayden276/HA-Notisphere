"""Pure rule repair and environmental health evaluation."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, replace
from enum import StrEnum

from ..models import (
    ConditionSpec,
    ConditionType,
    HealthIssue,
    NotificationRule,
    RuleHealth,
    RuleHealthStatus,
    TargetRef,
    TriggerSpec,
    TriggerType,
)
from ..recipients.manager import SYSTEM_GROUPS
from ..recipients.resolver import (
    DeliverySkipReason,
    required_endpoint_capabilities,
    resolve_audiences,
)
from .models import HealthEntitySnapshot, HealthUserSnapshot, RuleHealthSnapshot

_OWNED_ISSUE_PREFIX = "health_"
_TARGETED_CONDITIONS = frozenset(
    {
        ConditionType.PERSON_HOME,
        ConditionType.PERSON_AWAY,
        ConditionType.ENTITY_STATE,
    }
)
_NON_DEGRADING_SKIPS = frozenset({DeliverySkipReason.DUPLICATE_TARGET})


class _ReferenceState(StrEnum):
    FOUND = "found"
    MISSING = "missing"
    AMBIGUOUS = "ambiguous"


@dataclass(frozen=True, slots=True)
class _TargetResolution:
    target: TargetRef
    entity: HealthEntitySnapshot | None
    state: _ReferenceState


class RuleHealthReconciler:
    """Repair stable entity references and derive current health without I/O."""

    def reconcile(
        self, rule: NotificationRule, snapshot: RuleHealthSnapshot
    ) -> NotificationRule:
        by_entity_id = {entity.entity_id: entity for entity in snapshot.entities}
        registry_matches: dict[str, list[HealthEntitySnapshot]] = defaultdict(list)
        for entity in snapshot.entities:
            if entity.registry_id:
                registry_matches[entity.registry_id].append(entity)

        issues: list[HealthIssue] = []
        issue_statuses: list[RuleHealthStatus] = []
        trigger = self._reconcile_trigger(
            rule.trigger,
            by_entity_id,
            registry_matches,
            issues,
            issue_statuses,
        )
        conditions = tuple(
            self._reconcile_condition(
                index,
                condition,
                by_entity_id,
                registry_matches,
                issues,
                issue_statuses,
            )
            for index, condition in enumerate(rule.conditions, start=1)
        )
        self._evaluate_audiences(rule, snapshot, issues, issue_statuses)

        external_issues = tuple(
            issue
            for issue in rule.health.issues
            if not issue.code.startswith(_OWNED_ISSUE_PREFIX)
        )
        status_candidates = list(issue_statuses)
        if external_issues:
            status_candidates.append(rule.health.status)
        status = (
            max(status_candidates, key=_status_rank)
            if status_candidates
            else RuleHealthStatus.HEALTHY
        )
        health = RuleHealth(status, (*external_issues, *issues))
        return replace(rule, trigger=trigger, conditions=conditions, health=health)

    def _reconcile_trigger(
        self,
        trigger: TriggerSpec,
        by_entity_id: dict[str, HealthEntitySnapshot],
        registry_matches: dict[str, list[HealthEntitySnapshot]],
        issues: list[HealthIssue],
        statuses: list[RuleHealthStatus],
    ) -> TriggerSpec:
        if trigger.type is TriggerType.TIME:
            return trigger
        if trigger.target is None:
            issues.append(
                HealthIssue(
                    "health_trigger_missing",
                    "This rule no longer has a trigger target. Choose a device again.",
                )
            )
            statuses.append(RuleHealthStatus.NEEDS_ATTENTION)
            return trigger

        resolved = _resolve_target(trigger.target, by_entity_id, registry_matches)
        if resolved.state is not _ReferenceState.FOUND:
            qualifier = " uniquely" if resolved.state is _ReferenceState.AMBIGUOUS else ""
            issues.append(
                HealthIssue(
                    "health_trigger_missing",
                    f"{trigger.target.display_name_snapshot} can no longer be "
                    f"identified{qualifier}. Choose the trigger device again.",
                    trigger.target.entity_id,
                )
            )
            statuses.append(RuleHealthStatus.NEEDS_ATTENTION)
        elif resolved.entity is not None and not resolved.entity.available:
            issues.append(
                HealthIssue(
                    "health_trigger_unavailable",
                    f"{trigger.target.display_name_snapshot} is unavailable, so this "
                    "trigger cannot currently be satisfied.",
                    resolved.entity.entity_id,
                )
            )
            statuses.append(RuleHealthStatus.DEGRADED)
        return replace(trigger, target=resolved.target)

    def _reconcile_condition(
        self,
        index: int,
        condition: ConditionSpec,
        by_entity_id: dict[str, HealthEntitySnapshot],
        registry_matches: dict[str, list[HealthEntitySnapshot]],
        issues: list[HealthIssue],
        statuses: list[RuleHealthStatus],
    ) -> ConditionSpec:
        if condition.type not in _TARGETED_CONDITIONS:
            return condition
        if condition.target is None:
            issues.append(
                HealthIssue(
                    "health_condition_missing",
                    f"Condition {index} no longer has a target. Choose it again.",
                )
            )
            statuses.append(RuleHealthStatus.DEGRADED)
            return condition

        resolved = _resolve_target(condition.target, by_entity_id, registry_matches)
        if resolved.state is not _ReferenceState.FOUND:
            issues.append(
                HealthIssue(
                    "health_condition_missing",
                    f"Condition {index} uses {condition.target.display_name_snapshot}, "
                    "which can no longer be found. Choose it again.",
                    condition.target.entity_id,
                )
            )
            statuses.append(RuleHealthStatus.DEGRADED)
        elif resolved.entity is not None and not resolved.entity.available:
            issues.append(
                HealthIssue(
                    "health_condition_unavailable",
                    f"Condition {index} cannot be checked because "
                    f"{condition.target.display_name_snapshot} is unavailable.",
                    resolved.entity.entity_id,
                )
            )
            statuses.append(RuleHealthStatus.DEGRADED)
        return replace(condition, target=resolved.target)

    @staticmethod
    def _evaluate_audiences(
        rule: NotificationRule,
        snapshot: RuleHealthSnapshot,
        issues: list[HealthIssue],
        statuses: list[RuleHealthStatus],
    ) -> None:
        owner = next(
            (user for user in snapshot.directory_users if user.id == rule.owner_user_id),
            HealthUserSnapshot(rule.owner_user_id),
        )
        resolution = resolve_audiences(
            rule.audiences,
            snapshot.recipients,
            (*SYSTEM_GROUPS, *snapshot.groups),
            owner,
            snapshot.directory_users,
            required_endpoint_capabilities(rule),
        )
        degrading_skips = tuple(
            skipped for skipped in resolution.skipped if skipped.reason not in _NON_DEGRADING_SKIPS
        )
        if not resolution.deliveries:
            issues.append(
                HealthIssue(
                    "health_audience_unavailable",
                    "No recipients currently have a usable notification endpoint.",
                )
            )
            statuses.append(RuleHealthStatus.DEGRADED)
        elif degrading_skips:
            issues.append(
                HealthIssue(
                    "health_audience_partial",
                    "Some recipients do not currently have a usable notification endpoint.",
                )
            )
            statuses.append(RuleHealthStatus.DEGRADED)


def _resolve_target(
    target: TargetRef,
    by_entity_id: dict[str, HealthEntitySnapshot],
    registry_matches: dict[str, list[HealthEntitySnapshot]],
) -> _TargetResolution:
    if target.registry_id:
        matches = registry_matches.get(target.registry_id, [])
        if len(matches) == 1:
            entity = matches[0]
            return _TargetResolution(
                replace(target, entity_id=entity.entity_id),
                entity,
                _ReferenceState.FOUND,
            )
        state = _ReferenceState.AMBIGUOUS if matches else _ReferenceState.MISSING
        return _TargetResolution(target, None, state)

    exact_entity = by_entity_id.get(target.entity_id)
    if exact_entity is None:
        return _TargetResolution(target, None, _ReferenceState.MISSING)
    return _TargetResolution(target, exact_entity, _ReferenceState.FOUND)


def _status_rank(status: RuleHealthStatus) -> int:
    return {
        RuleHealthStatus.HEALTHY: 0,
        RuleHealthStatus.DEGRADED: 1,
        RuleHealthStatus.NEEDS_ATTENTION: 2,
    }[status]


__all__ = ["RuleHealthReconciler"]
