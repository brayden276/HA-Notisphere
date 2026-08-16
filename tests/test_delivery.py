from __future__ import annotations

import asyncio

from custom_components.notification_manager.models import (
    DeliveryEndpoint,
    DeliveryPolicy,
    EndpointCapability,
    EndpointType,
    NotificationAction,
    NotificationContent,
    Urgency,
)
from custom_components.notification_manager.recipients.delivery import (
    HomeAssistantNotificationDelivery,
)


def run(coroutine):  # type: ignore[no-untyped-def]
    return asyncio.run(coroutine)


class RecordingServices:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, object], bool]] = []

    async def async_call(
        self, domain: str, service: str, payload: dict[str, object], *, blocking: bool
    ) -> None:
        self.calls.append((domain, service, payload, blocking))


class FakeHass:
    def __init__(self) -> None:
        self.services = RecordingServices()


def test_mobile_payload_translates_only_confirmed_rich_capabilities() -> None:
    async def scenario() -> None:
        hass = FakeHass()
        delivery = HomeAssistantNotificationDelivery(hass)
        endpoint = DeliveryEndpoint(
            id="phone",
            type=EndpointType.HA_NOTIFY,
            target="notify.mobile_app_alice",
            platform="mobile_app",
            capabilities=frozenset(EndpointCapability),
        )
        content = NotificationContent(
            "Garage door",
            "The garage door is still open.",
            image_url="/api/camera_proxy/camera.garage",
            deep_link="/lovelace/garage",
            actions=(NotificationAction("CLOSE", "Close garage"),),
        )

        await delivery.async_send(
            endpoint,
            content,
            DeliveryPolicy(Urgency.CRITICAL, sound="alarm.caf"),
            replacement_key="rule-garage",
        )

        assert hass.services.calls == [
            (
                "notify",
                "mobile_app_alice",
                {
                    "message": "The garage door is still open.",
                    "title": "Garage door",
                    "data": {
                        "image": "/api/camera_proxy/camera.garage",
                        "url": "/lovelace/garage",
                        "actions": [{"action": "CLOSE", "title": "Close garage"}],
                        "tag": "rule-garage",
                        "ttl": 0,
                        "priority": "high",
                        "push": {
                            "sound": {
                                "name": "alarm.caf",
                                "critical": 1,
                                "volume": 1.0,
                            }
                        },
                    },
                },
                True,
            )
        ]

    run(scenario())


def test_mobile_payload_omits_unconfirmed_optional_features() -> None:
    async def scenario() -> None:
        hass = FakeHass()
        delivery = HomeAssistantNotificationDelivery(hass)
        endpoint = DeliveryEndpoint(
            id="phone",
            type=EndpointType.HA_NOTIFY,
            target="notify.mobile_app_alice",
            platform="mobile_app",
        )

        await delivery.async_send(
            endpoint,
            NotificationContent(
                "Garage door",
                "Open",
                image_url="https://example.invalid/image.jpg",
                deep_link="/lovelace/garage",
                actions=(NotificationAction("OPEN", "Open"),),
            ),
            DeliveryPolicy(Urgency.CRITICAL, sound="alarm.caf"),
            replacement_key="rule-garage",
        )

        assert hass.services.calls[0][2] == {"message": "Open"}

    run(scenario())


def test_important_payload_uses_cross_platform_time_sensitive_hints() -> None:
    async def scenario() -> None:
        hass = FakeHass()
        delivery = HomeAssistantNotificationDelivery(hass)
        endpoint = DeliveryEndpoint(
            id="phone",
            type=EndpointType.HA_NOTIFY,
            target="notify.mobile_app_alice",
            platform="mobile_app",
            capabilities=frozenset({EndpointCapability.IMPORTANT}),
        )

        await delivery.async_send(
            endpoint,
            NotificationContent("Garage door", "Still open"),
            DeliveryPolicy(Urgency.IMPORTANT),
        )

        assert hass.services.calls[0][2] == {
            "message": "Still open",
            "data": {
                "ttl": 0,
                "priority": "high",
                "push": {"interruption-level": "time-sensitive"},
            },
        }

    run(scenario())
