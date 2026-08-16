"""Pure audience expansion, endpoint selection and physical-target deduplication."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

from ..models import (
    Audience,
    AudienceType,
    DeliveryEndpoint,
    EndpointCapability,
    GroupType,
    NotificationRule,
    RecipientGroup,
    RecipientProfile,
    SystemGroupType,
    Urgency,
)


class RequestIdentity(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def is_admin(self) -> bool: ...


class DeliverySkipReason(StrEnum):
    RECIPIENT_NOT_FOUND = "recipient_not_found"
    GROUP_NOT_FOUND = "group_not_found"
    NO_ENDPOINTS = "no_endpoints"
    ENDPOINTS_DISABLED = "endpoints_disabled"
    UNSUPPORTED_CAPABILITIES = "unsupported_capabilities"
    CRITICAL_NOT_ALLOWED = "critical_not_allowed"
    DUPLICATE_TARGET = "duplicate_target"


@dataclass(frozen=True, slots=True)
class ResolvedDelivery:
    recipient: RecipientProfile
    endpoint: DeliveryEndpoint


@dataclass(frozen=True, slots=True)
class SkippedDelivery:
    reason: DeliverySkipReason
    detail: str
    recipient_id: str | None = None
    endpoint_id: str | None = None


@dataclass(frozen=True, slots=True)
class AudienceResolution:
    deliveries: tuple[ResolvedDelivery, ...]
    skipped: tuple[SkippedDelivery, ...]


def required_endpoint_capabilities(
    rule: NotificationRule,
) -> frozenset[EndpointCapability]:
    """Return capabilities that must be present to preserve a rule's intent."""

    required: set[EndpointCapability] = set()
    if rule.delivery_policy.urgency is Urgency.IMPORTANT:
        required.add(EndpointCapability.IMPORTANT)
    elif rule.delivery_policy.urgency is Urgency.CRITICAL:
        required.update({EndpointCapability.CRITICAL, EndpointCapability.SOUND})
    elif rule.delivery_policy.sound:
        required.add(EndpointCapability.SOUND)
    if rule.content.image_url:
        required.add(EndpointCapability.IMAGE)
    if rule.content.deep_link:
        required.add(EndpointCapability.DEEP_LINK)
    if rule.content.actions:
        required.add(EndpointCapability.ACTIONS)
    if rule.behaviour.replace_previous:
        required.add(EndpointCapability.REPLACEMENT)
    return frozenset(required)


def primary_endpoint(
    recipient: RecipientProfile,
    required_capabilities: frozenset[EndpointCapability] = frozenset(),
) -> tuple[DeliveryEndpoint | None, SkippedDelivery | None]:
    """Select the preferred endpoint, then the highest-priority compatible endpoint."""

    if (
        EndpointCapability.CRITICAL in required_capabilities
        and not recipient.preferences.allow_critical
    ):
        return None, SkippedDelivery(
            DeliverySkipReason.CRITICAL_NOT_ALLOWED,
            "Recipient preferences do not allow critical notifications.",
            recipient.id,
        )
    if not recipient.endpoints:
        return None, SkippedDelivery(
            DeliverySkipReason.NO_ENDPOINTS,
            "Recipient has no notification endpoint.",
            recipient.id,
        )
    enabled = tuple(endpoint for endpoint in recipient.endpoints if endpoint.enabled)
    if not enabled:
        return None, SkippedDelivery(
            DeliverySkipReason.ENDPOINTS_DISABLED,
            "Recipient has no enabled notification endpoint.",
            recipient.id,
        )
    compatible = tuple(
        endpoint
        for endpoint in enabled
        if required_capabilities.issubset(endpoint.capabilities)
    )
    if not compatible:
        required = ", ".join(
            sorted(item.value.replace("_", " ") for item in required_capabilities)
        )
        return None, SkippedDelivery(
            DeliverySkipReason.UNSUPPORTED_CAPABILITIES,
            f"This phone does not support all selected notification options ({required}).",
            recipient.id,
        )

    preferred_id = recipient.preferences.preferred_endpoint_id
    preferred = next((item for item in compatible if item.id == preferred_id), None)
    if preferred is not None:
        return preferred, None
    return min(compatible, key=lambda item: (-item.priority, item.id)), None


def resolve_audiences(
    audiences: tuple[Audience, ...],
    recipients: tuple[RecipientProfile, ...],
    groups: tuple[RecipientGroup, ...],
    current_user: RequestIdentity,
    directory_users: tuple[RequestIdentity, ...],
    required_capabilities: frozenset[EndpointCapability] = frozenset(),
) -> AudienceResolution:
    """Expand overlapping audiences and deduplicate their physical notify targets."""

    recipients_by_id = {item.id: item for item in recipients}
    recipients_by_user = {item.ha_user_id: item for item in recipients}
    groups_by_id = {item.id: item for item in groups}
    admin_user_ids = {item.id for item in directory_users if item.is_admin}
    selected_ids: list[str] = []
    skipped: list[SkippedDelivery] = []

    def add_recipient(recipient_id: str) -> None:
        if recipient_id not in recipients_by_id:
            skipped.append(
                SkippedDelivery(
                    DeliverySkipReason.RECIPIENT_NOT_FOUND,
                    "A selected household member no longer exists.",
                    recipient_id,
                )
            )
        elif recipient_id not in selected_ids:
            selected_ids.append(recipient_id)

    def add_system(system_type: SystemGroupType) -> None:
        for recipient in recipients:
            if (
                system_type is SystemGroupType.EVERYONE
                or recipient.ha_user_id in admin_user_ids
            ):
                add_recipient(recipient.id)

    for audience in audiences:
        if audience.type is AudienceType.ME:
            recipient = recipients_by_user.get(current_user.id)
            if recipient is None:
                skipped.append(
                    SkippedDelivery(
                        DeliverySkipReason.RECIPIENT_NOT_FOUND,
                        "The current user has no recipient mapping.",
                    )
                )
            else:
                add_recipient(recipient.id)
        elif audience.type is AudienceType.RECIPIENT and audience.recipient_id:
            add_recipient(audience.recipient_id)
        elif audience.type is AudienceType.EVERYONE:
            add_system(SystemGroupType.EVERYONE)
        elif audience.type is AudienceType.ADMINS:
            add_system(SystemGroupType.ADMINS)
        elif audience.type is AudienceType.GROUP and audience.group_id:
            group = groups_by_id.get(audience.group_id)
            if group is None:
                skipped.append(
                    SkippedDelivery(
                        DeliverySkipReason.GROUP_NOT_FOUND,
                        "A selected notification group no longer exists.",
                    )
                )
            elif group.type is GroupType.SYSTEM and group.system_type is not None:
                add_system(group.system_type)
            else:
                for recipient_id in group.member_recipient_ids:
                    add_recipient(recipient_id)

    deliveries: list[ResolvedDelivery] = []
    seen_targets: set[tuple[str, str]] = set()
    for recipient_id in selected_ids:
        recipient = recipients_by_id[recipient_id]
        endpoint, endpoint_skip = primary_endpoint(recipient, required_capabilities)
        if endpoint_skip is not None:
            skipped.append(endpoint_skip)
            continue
        if endpoint is None:  # pragma: no cover - protected by the result contract
            continue
        target_key = (endpoint.type.value, endpoint.target.casefold())
        if target_key in seen_targets:
            skipped.append(
                SkippedDelivery(
                    DeliverySkipReason.DUPLICATE_TARGET,
                    "Another selected recipient uses the same physical notification target.",
                    recipient.id,
                    endpoint.id,
                )
            )
            continue
        seen_targets.add(target_key)
        deliveries.append(ResolvedDelivery(recipient, endpoint))

    return AudienceResolution(tuple(deliveries), tuple(skipped))


__all__ = [
    "AudienceResolution",
    "DeliverySkipReason",
    "RequestIdentity",
    "ResolvedDelivery",
    "SkippedDelivery",
    "primary_endpoint",
    "required_endpoint_capabilities",
    "resolve_audiences",
]
