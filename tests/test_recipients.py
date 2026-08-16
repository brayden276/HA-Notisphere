from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from typing import Any

import pytest

from custom_components.notification_manager.models import (
    Audience,
    AudienceType,
    DeliveryEndpoint,
    EndpointCapability,
    EndpointType,
    GroupType,
    NotificationAction,
    NotificationContent,
    RecipientGroup,
    RecipientPreferences,
    RecipientProfile,
    RecipientResultStatus,
)
from custom_components.notification_manager.recipients.delivery import (
    HomeAssistantNotificationDelivery,
)
from custom_components.notification_manager.recipients.discovery import (
    PersonSnapshot,
    UnconfirmedReason,
    UserSnapshot,
    discover_recipients,
)
from custom_components.notification_manager.recipients.manager import (
    SYSTEM_ADMINS_GROUP_ID,
    SYSTEM_EVERYONE_GROUP_ID,
    RecipientManager,
    RecipientPermissionDeniedError,
)
from custom_components.notification_manager.recipients.resolver import DeliverySkipReason
from custom_components.notification_manager.storage import InMemoryStorageBackend, RuleRepository


@dataclass(frozen=True, slots=True)
class Identity:
    id: str
    is_admin: bool


def run(coroutine):  # type: ignore[no-untyped-def]
    return asyncio.run(coroutine)


def endpoint(
    identifier: str,
    target: str,
    *,
    capabilities: frozenset[EndpointCapability] = frozenset(),
    enabled: bool = True,
    priority: int = 0,
) -> DeliveryEndpoint:
    return DeliveryEndpoint(
        id=identifier,
        type=EndpointType.HA_NOTIFY,
        target=target,
        platform="mobile_app",
        capabilities=capabilities,
        enabled=enabled,
        priority=priority,
    )


def recipient(
    identifier: str,
    user_id: str,
    *endpoints: DeliveryEndpoint,
    preferred: str | None = None,
) -> RecipientProfile:
    return RecipientProfile(
        id=identifier,
        ha_user_id=user_id,
        display_name=identifier.title(),
        endpoints=endpoints,
        preferences=RecipientPreferences(preferred),
    )


def test_system_and_custom_groups_resolve_from_current_user_directory() -> None:
    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend())
        manager = RecipientManager(repository)
        alice = recipient("alice", "user-a", endpoint("a", "notify.mobile_app_alice"))
        bob = recipient("bob", "user-b", endpoint("b", "notify.mobile_app_bob"))
        await manager.replace_discovered_recipients((alice, bob))
        admin = Identity("user-a", True)
        ordinary = Identity("user-b", False)

        assert [group.id for group in await manager.list_groups()] == [
            SYSTEM_EVERYONE_GROUP_ID,
            SYSTEM_ADMINS_GROUP_ID,
        ]
        custom = RecipientGroup("night-shift", "Night shift", GroupType.CUSTOM, (bob.id,))
        with pytest.raises(RecipientPermissionDeniedError):
            await manager.create_group(custom, ordinary)
        await manager.create_group(custom, admin)
        assert (await manager.list_groups())[-1] == custom

        everyone = await manager.resolve_audiences(
            (Audience(AudienceType.EVERYONE),), admin, (admin, ordinary)
        )
        admins = await manager.resolve_audiences(
            (Audience(AudienceType.ADMINS),), ordinary, (admin, ordinary)
        )
        group = await manager.resolve_audiences(
            (Audience(AudienceType.GROUP, group_id=custom.id),), admin, (admin, ordinary)
        )
        assert {item.recipient.id for item in everyone.deliveries} == {alice.id, bob.id}
        assert [item.recipient.id for item in admins.deliveries] == [alice.id]
        assert [item.recipient.id for item in group.deliveries] == [bob.id]

        updated = replace(custom, name="After hours", member_recipient_ids=(alice.id, bob.id))
        assert await manager.update_group(updated, admin) == updated
        await manager.delete_group(updated.id, admin)
        assert [item.id for item in await manager.list_groups()] == [
            SYSTEM_EVERYONE_GROUP_ID,
            SYSTEM_ADMINS_GROUP_ID,
        ]

    run(scenario())


def test_overlapping_audiences_and_shared_physical_targets_are_deduplicated() -> None:
    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend())
        manager = RecipientManager(repository)
        alice = recipient("alice", "user-a", endpoint("a", "notify.mobile_app_shared"))
        bob = recipient("bob", "user-b", endpoint("b", "notify.mobile_app_shared"))
        carol = recipient("carol", "user-c", endpoint("c", "notify.mobile_app_carol"))
        await manager.replace_discovered_recipients((alice, bob, carol))
        admin = Identity("user-a", True)
        users = (admin, Identity("user-b", False), Identity("user-c", False))
        await manager.create_group(
            RecipientGroup("family", "Family", GroupType.CUSTOM, (bob.id, carol.id)), admin
        )

        result = await manager.resolve_audiences(
            (
                Audience(AudienceType.EVERYONE),
                Audience(AudienceType.RECIPIENT, recipient_id=alice.id),
                Audience(AudienceType.GROUP, group_id="family"),
            ),
            admin,
            users,
        )

        assert [item.endpoint.target for item in result.deliveries] == [
            "notify.mobile_app_shared",
            "notify.mobile_app_carol",
        ]
        duplicates = [
            item for item in result.skipped if item.reason is DeliverySkipReason.DUPLICATE_TARGET
        ]
        assert [(item.recipient_id, item.endpoint_id) for item in duplicates] == [("bob", "b")]

    run(scenario())


def test_primary_endpoint_and_capability_filtering_have_explicit_skip_reasons() -> None:
    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend())
        manager = RecipientManager(repository)
        actions = frozenset({EndpointCapability.ACTIONS})
        selected = recipient(
            "selected",
            "user-a",
            endpoint(
                "disabled-preferred",
                "notify.mobile_app_disabled",
                capabilities=actions,
                enabled=False,
                priority=100,
            ),
            endpoint(
                "fallback",
                "notify.mobile_app_fallback",
                capabilities=actions,
                priority=5,
            ),
            preferred="disabled-preferred",
        )
        unsupported = recipient(
            "unsupported",
            "user-b",
            endpoint(
                "title-only",
                "notify.mobile_app_title",
                capabilities=frozenset({EndpointCapability.TITLE}),
            ),
        )
        disabled = recipient(
            "disabled",
            "user-c",
            endpoint("off", "notify.mobile_app_off", enabled=False),
        )
        missing = recipient("missing", "user-d")
        await manager.replace_discovered_recipients((selected, unsupported, disabled, missing))

        primary, skipped = manager.primary_endpoint(selected, actions)
        assert primary is not None and primary.id == "fallback"
        assert skipped is None
        assert manager.primary_endpoint(disabled)[1].reason is DeliverySkipReason.ENDPOINTS_DISABLED  # type: ignore[union-attr]
        assert manager.primary_endpoint(missing)[1].reason is DeliverySkipReason.NO_ENDPOINTS  # type: ignore[union-attr]

        admin = Identity("user-a", True)
        result = await manager.resolve_audiences(
            (Audience(AudienceType.EVERYONE),),
            admin,
            (
                admin,
                Identity("user-b", False),
                Identity("user-c", False),
                Identity("user-d", False),
            ),
            actions,
        )
        assert [item.recipient.id for item in result.deliveries] == [selected.id]
        assert {item.reason for item in result.skipped} == {
            DeliverySkipReason.UNSUPPORTED_CAPABILITIES,
            DeliverySkipReason.ENDPOINTS_DISABLED,
            DeliverySkipReason.NO_ENDPOINTS,
        }
        unsupported_skip = next(
            item
            for item in result.skipped
            if item.reason is DeliverySkipReason.UNSUPPORTED_CAPABILITIES
        )
        assert "actions" in unsupported_skip.detail

    run(scenario())


def test_discovery_confirms_unique_relationships_and_leaves_ambiguity_unmapped() -> None:
    users = (
        UserSnapshot("user-a", "Alice", True),
        UserSnapshot("user-x1", "Alex"),
        UserSnapshot("user-x2", "Alex"),
    )
    result = discover_recipients(
        users,
        (
            PersonSnapshot("person.alice", "Alice", "user-a"),
            PersonSnapshot("person.alex", "Alex"),
        ),
        (
            "notify.mobile_app_alice",
            "mobile_app_alex",
            "notify.house_speakers",
        ),
    )

    by_user = {item.ha_user_id: item for item in result.recipients}
    assert by_user["user-a"].person_entity_id == "person.alice"
    assert [item.target for item in by_user["user-a"].endpoints] == [
        "notify.mobile_app_alice"
    ]
    assert by_user["user-x1"].endpoints == ()
    assert by_user["user-x2"].endpoints == ()
    ambiguity = next(item for item in result.unconfirmed if item.source == "notify.mobile_app_alex")
    assert ambiguity.reason is UnconfirmedReason.AMBIGUOUS_MATCH
    assert ambiguity.candidate_user_ids == ("user-x1", "user-x2")
    person_ambiguity = next(item for item in result.unconfirmed if item.source == "person.alex")
    assert person_ambiguity.candidate_user_ids == ("user-x1", "user-x2")


def test_existing_confirmed_endpoint_mapping_is_preserved_by_discovery() -> None:
    prior = recipient(
        "recipient-a",
        "user-a",
        endpoint("custom-id", "notify.mobile_app_kitchen_tablet", priority=9),
        preferred="custom-id",
    )
    result = discover_recipients(
        (UserSnapshot("user-a", "Alice"),),
        (),
        ("notify.mobile_app_kitchen_tablet", "mobile_app_kitchen_tablet"),
        (prior,),
    )
    assert result.recipients[0].endpoints == prior.endpoints
    assert result.recipients[0].preferences == prior.preferences
    assert result.unconfirmed == ()


def test_confirmed_unlinked_person_mapping_is_preserved_by_discovery() -> None:
    prior = replace(
        recipient("recipient-a", "user-a"),
        person_entity_id="person.household_alice",
    )

    result = discover_recipients(
        (UserSnapshot("user-a", "Alice"),),
        (PersonSnapshot("person.household_alice", "Household Alice"),),
        (),
        (prior,),
    )

    assert result.recipients[0].person_entity_id == "person.household_alice"
    assert result.unconfirmed == ()


def test_admin_can_confirm_discovered_phone_without_exposing_it_as_manual_input() -> None:
    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend())
        manager = RecipientManager(repository)
        alice = recipient("alice", "user-a")
        bob = recipient("bob", "user-b")
        await manager.replace_discovered_recipients((alice, bob))

        with pytest.raises(RecipientPermissionDeniedError):
            await manager.confirm_discovery_mapping(
                "notify.mobile_app_alice_phone", alice.id, Identity("user-a", False)
            )

        saved = await manager.confirm_discovery_mapping(
            "notify.mobile_app_alice_phone", alice.id, Identity("admin", True)
        )
        assert [item.target for item in saved.endpoints] == [
            "notify.mobile_app_alice_phone"
        ]
        assert EndpointCapability.TITLE in saved.endpoints[0].capabilities

    run(scenario())


def test_non_admin_recipient_update_can_only_change_preferences() -> None:
    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend())
        manager = RecipientManager(repository)
        original = recipient(
            "alice",
            "user-a",
            endpoint("alice-phone", "notify.mobile_app_alice"),
        )
        await manager.replace_discovered_recipients((original,))
        tampered = replace(
            original,
            display_name="Changed name",
            person_entity_id="person.someone_else",
            endpoints=(endpoint("alice-phone", "notify.mobile_app_someone_else"),),
            preferences=RecipientPreferences("alice-phone", allow_critical=False),
        )

        saved = await manager.update_recipient(tampered, Identity("user-a", False))

        assert saved.display_name == original.display_name
        assert saved.person_entity_id == original.person_entity_id
        assert saved.endpoints == original.endpoints
        assert saved.preferences == tampered.preferences

    run(scenario())


def test_unconfirmed_relationship_serialises_a_human_display_name() -> None:
    result = discover_recipients(
        (UserSnapshot("user-a", "Alice"),),
        (),
        ("notify.mobile_app_alice_pixel_9",),
    )

    issue = result.unconfirmed[0].to_dict()
    assert issue["display_name"] == "Alice Pixel 9"
    assert issue["source_type"] == "phone"


def test_test_notification_uses_primary_endpoint_and_reports_delivery_result() -> None:
    class RecordingDelivery:
        def __init__(self) -> None:
            self.calls: list[tuple[DeliveryEndpoint, NotificationContent]] = []

        async def async_send(
            self, selected_endpoint: DeliveryEndpoint, content: NotificationContent
        ) -> None:
            self.calls.append((selected_endpoint, content))

    async def scenario() -> None:
        repository = RuleRepository(InMemoryStorageBackend())
        manager = RecipientManager(repository)
        profile = recipient(
            "alice",
            "user-a",
            endpoint("phone", "notify.mobile_app_alice"),
            preferred="phone",
        )
        await manager.replace_discovered_recipients((profile,))
        delivery = RecordingDelivery()

        result = await manager.test_notification("alice", Identity("user-a", False), delivery)
        assert result.status is RecipientResultStatus.SENT
        assert delivery.calls[0][0].id == "phone"
        assert delivery.calls[0][1].title == "Notification Manager test"
        with pytest.raises(RecipientPermissionDeniedError):
            await manager.test_notification("alice", Identity("user-b", False), delivery)

    run(scenario())


def test_home_assistant_delivery_calls_the_selected_notify_service() -> None:
    class Services:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str, dict[str, Any], bool]] = []

        async def async_call(
            self, domain: str, service: str, data: dict[str, Any], *, blocking: bool
        ) -> None:
            self.calls.append((domain, service, data, blocking))

    class Hass:
        def __init__(self) -> None:
            self.services = Services()

    async def scenario() -> None:
        hass = Hass()
        adapter = HomeAssistantNotificationDelivery(hass)
        selected_endpoint = endpoint(
            "phone",
            "notify.mobile_app_alice",
            capabilities=frozenset(
                {
                    EndpointCapability.TITLE,
                    EndpointCapability.IMAGE,
                    EndpointCapability.ACTIONS,
                    EndpointCapability.DEEP_LINK,
                }
            ),
        )
        await adapter.async_send(
            selected_endpoint,
            NotificationContent(
                "Door",
                "The door is open.",
                image_url="https://example.test/door.jpg",
                deep_link="/dashboard/door",
                actions=(NotificationAction("VIEW", "View", "/dashboard/door"),),
            ),
        )
        assert hass.services.calls == [
            (
                "notify",
                "mobile_app_alice",
                {
                    "message": "The door is open.",
                    "title": "Door",
                    "data": {
                        "image": "https://example.test/door.jpg",
                        "url": "/dashboard/door",
                        "actions": [
                            {"action": "VIEW", "title": "View", "uri": "/dashboard/door"}
                        ],
                    },
                },
                True,
            )
        ]

    run(scenario())
