"""Pure, conservative matching of HA users, people and mobile-app notify services."""

from __future__ import annotations

import re
from dataclasses import dataclass, replace
from enum import StrEnum

from ..models import (
    DeliveryEndpoint,
    EndpointCapability,
    EndpointType,
    RecipientPreferences,
    RecipientProfile,
)

MOBILE_APP_CAPABILITIES = frozenset(
    {
        EndpointCapability.TITLE,
        EndpointCapability.IMAGE,
        EndpointCapability.ACTIONS,
        EndpointCapability.DEEP_LINK,
        EndpointCapability.REPLACEMENT,
    }
)


@dataclass(frozen=True, slots=True)
class UserSnapshot:
    id: str
    name: str
    is_admin: bool = False


@dataclass(frozen=True, slots=True)
class PersonSnapshot:
    entity_id: str
    name: str
    user_id: str | None = None


class UnconfirmedReason(StrEnum):
    NO_MATCH = "no_match"
    UNVERIFIED_MATCH = "unverified_match"
    AMBIGUOUS_MATCH = "ambiguous_match"
    DUPLICATE_PERSON_MAPPING = "duplicate_person_mapping"


@dataclass(frozen=True, slots=True)
class UnconfirmedRelationship:
    source: str
    reason: UnconfirmedReason
    candidate_user_ids: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, object]:
        return {
            "source": self.source,
            "display_name": _friendly_source_name(self.source),
            "source_type": "phone" if self.source.startswith("notify.") else "person",
            "reason": self.reason.value,
            "candidate_user_ids": list(self.candidate_user_ids),
        }


@dataclass(frozen=True, slots=True)
class DiscoveryResult:
    recipients: tuple[RecipientProfile, ...]
    unconfirmed: tuple[UnconfirmedRelationship, ...]


def discover_recipients(
    users: tuple[UserSnapshot, ...],
    people: tuple[PersonSnapshot, ...],
    notify_service_names: tuple[str, ...],
    existing: tuple[RecipientProfile, ...] = (),
) -> DiscoveryResult:
    """Build mappings only where the user relationship has one confident match."""

    users_by_id = {item.id: item for item in users}
    existing_by_user = {item.ha_user_id: item for item in existing}
    people_by_user: dict[str, list[PersonSnapshot]] = {}
    for person in people:
        if person.user_id in users_by_id:
            people_by_user.setdefault(person.user_id, []).append(person)

    unconfirmed: list[UnconfirmedRelationship] = []
    confirmed_person: dict[str, PersonSnapshot] = {}
    for user_id, matches in people_by_user.items():
        if len(matches) == 1:
            confirmed_person[user_id] = matches[0]
        else:
            for person in matches:
                unconfirmed.append(
                    UnconfirmedRelationship(
                        person.entity_id,
                        UnconfirmedReason.DUPLICATE_PERSON_MAPPING,
                        (user_id,),
                    )
                )

    people_by_entity_id = {person.entity_id: person for person in people}
    for user_id, existing_recipient in existing_by_user.items():
        if user_id in confirmed_person or not existing_recipient.person_entity_id:
            continue
        existing_person = people_by_entity_id.get(existing_recipient.person_entity_id)
        if existing_person is not None and existing_person.user_id in {None, user_id}:
            confirmed_person[user_id] = existing_person

    for person in people:
        if person.user_id in users_by_id or any(
            confirmed.entity_id == person.entity_id
            for confirmed in confirmed_person.values()
        ):
            continue
        candidates = tuple(
            sorted(user.id for user in users if _match_key(user.name) == _match_key(person.name))
        )
        unconfirmed.append(
            UnconfirmedRelationship(
                person.entity_id,
                UnconfirmedReason.AMBIGUOUS_MATCH
                if len(candidates) > 1
                else (
                    UnconfirmedReason.UNVERIFIED_MATCH
                    if candidates
                    else UnconfirmedReason.NO_MATCH
                ),
                candidates,
            )
        )

    endpoint_targets_by_user: dict[str, list[str]] = {item.id: [] for item in users}
    existing_target_users: dict[str, list[str]] = {}
    for recipient in existing:
        if recipient.ha_user_id not in users_by_id:
            continue
        for endpoint in recipient.endpoints:
            existing_target_users.setdefault(endpoint.target.casefold(), []).append(
                recipient.ha_user_id
            )
    notify_targets = sorted(
        {
            target
            for raw_service in notify_service_names
            if (target := _normalise_notify_target(raw_service)) is not None
        }
    )
    for target in notify_targets:
        existing_user_ids = existing_target_users.get(target, ())
        if existing_user_ids:
            for existing_user_id in existing_user_ids:
                endpoint_targets_by_user[existing_user_id].append(target)
            continue
        service_key = _match_key(target.removeprefix("notify.mobile_app_"))
        candidates = tuple(
            sorted(
                user.id
                for user in users
                if service_key
                and service_key
                in {
                    _match_key(user.name),
                    _match_key(confirmed_person[user.id].name)
                    if user.id in confirmed_person
                    else "",
                    _match_key(
                        confirmed_person[user.id].entity_id.removeprefix("person.")
                    )
                    if user.id in confirmed_person
                    else "",
                }
            )
        )
        if len(candidates) == 1:
            endpoint_targets_by_user[candidates[0]].append(target)
        else:
            unconfirmed.append(
                UnconfirmedRelationship(
                    target,
                    UnconfirmedReason.AMBIGUOUS_MATCH
                    if candidates
                    else UnconfirmedReason.NO_MATCH,
                    candidates,
                )
            )

    recipients: list[RecipientProfile] = []
    visible_targets = {
        target for targets in endpoint_targets_by_user.values() for target in targets
    }
    for user in users:
        prior = existing_by_user.get(user.id)
        discovered_targets = endpoint_targets_by_user[user.id]
        endpoints_by_target = {
            endpoint.target.casefold(): endpoint
            for endpoint in prior.endpoints
            if prior is not None and endpoint.target.casefold() in visible_targets
        } if prior is not None else {}
        endpoints = tuple(
            endpoints_by_target.get(target.casefold()) or mobile_app_endpoint(target)
            for target in discovered_targets
        )
        person_for_user = confirmed_person.get(user.id)
        preferred_id = prior.preferences.preferred_endpoint_id if prior is not None else None
        if preferred_id not in {item.id for item in endpoints}:
            preferred_id = None
        preferences = replace(
            prior.preferences if prior is not None else RecipientPreferences(),
            preferred_endpoint_id=preferred_id,
        )
        recipients.append(
            RecipientProfile(
                id=prior.id if prior is not None else f"recipient:{user.id}",
                ha_user_id=user.id,
                display_name=user.name or (prior.display_name if prior is not None else user.id),
                person_entity_id=(
                    person_for_user.entity_id if person_for_user is not None else None
                ),
                endpoints=endpoints,
                preferences=preferences,
            )
        )

    return DiscoveryResult(tuple(recipients), tuple(unconfirmed))


def _normalise_notify_target(service: str) -> str | None:
    value = service.strip().casefold()
    if value.startswith("notify."):
        value = value.removeprefix("notify.")
    if not value.startswith("mobile_app_"):
        return None
    return f"notify.{value}"


def _match_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def mobile_app_endpoint(target: str) -> DeliveryEndpoint:
    """Build the conservative baseline endpoint for one validated mobile-app target."""

    normalised = _normalise_notify_target(target)
    if normalised is None:
        raise ValueError("Only Home Assistant mobile app notification targets are supported")
    target = normalised
    service_name = target.removeprefix("notify.")
    return DeliveryEndpoint(
        id=f"ha-notify:{service_name}",
        type=EndpointType.HA_NOTIFY,
        target=target,
        platform="mobile_app",
        capabilities=MOBILE_APP_CAPABILITIES,
    )


def _friendly_source_name(source: str) -> str:
    value = source.removeprefix("notify.mobile_app_").removeprefix("person.")
    words = re.sub(r"[_-]+", " ", value).strip()
    return words.title() or "Unidentified device"


__all__ = [
    "MOBILE_APP_CAPABILITIES",
    "DiscoveryResult",
    "PersonSnapshot",
    "UnconfirmedReason",
    "UnconfirmedRelationship",
    "UserSnapshot",
    "discover_recipients",
    "mobile_app_endpoint",
]
