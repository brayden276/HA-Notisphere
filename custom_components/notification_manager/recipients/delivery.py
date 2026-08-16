"""Notification delivery protocol and Home Assistant notify-service adapter."""

from __future__ import annotations

from typing import Any, Protocol

from ..models import (
    DeliveryEndpoint,
    DeliveryPolicy,
    EndpointCapability,
    NotificationContent,
    Urgency,
)


class NotificationDelivery(Protocol):
    async def async_send(
        self,
        endpoint: DeliveryEndpoint,
        content: NotificationContent,
        policy: DeliveryPolicy | None = None,
        *,
        replacement_key: str | None = None,
    ) -> None: ...


class HomeAssistantNotificationDelivery:
    def __init__(self, hass: Any) -> None:
        self._hass = hass

    async def async_send(
        self,
        endpoint: DeliveryEndpoint,
        content: NotificationContent,
        policy: DeliveryPolicy | None = None,
        *,
        replacement_key: str | None = None,
    ) -> None:
        if not endpoint.target.startswith("notify.mobile_app_"):
            raise ValueError("Delivery endpoints must target notify.mobile_app_* services")

        payload: dict[str, Any] = {"message": content.message}
        if EndpointCapability.TITLE in endpoint.capabilities:
            payload["title"] = content.title
        data: dict[str, Any] = {}
        if content.image_url and EndpointCapability.IMAGE in endpoint.capabilities:
            data["image"] = content.image_url
        if content.deep_link and EndpointCapability.DEEP_LINK in endpoint.capabilities:
            data["url"] = content.deep_link
        if content.actions and EndpointCapability.ACTIONS in endpoint.capabilities:
            data["actions"] = [
                {
                    "action": action.id,
                    "title": action.title,
                    **({"uri": action.uri} if action.uri else {}),
                }
                for action in content.actions
            ]
        if replacement_key and EndpointCapability.REPLACEMENT in endpoint.capabilities:
            data["tag"] = replacement_key
        if policy is not None:
            if policy.urgency is Urgency.CRITICAL:
                if EndpointCapability.CRITICAL in endpoint.capabilities:
                    data["ttl"] = 0
                    data["priority"] = "high"
                    if EndpointCapability.SOUND in endpoint.capabilities:
                        data["push"] = {
                            "sound": {
                                "name": policy.sound or "default",
                                "critical": 1,
                                "volume": 1.0,
                            }
                        }
            elif policy.sound and EndpointCapability.SOUND in endpoint.capabilities:
                data["push"] = {"sound": {"name": policy.sound}}
        if data:
            payload["data"] = data

        await self._hass.services.async_call(
            "notify",
            endpoint.target.removeprefix("notify."),
            payload,
            blocking=True,
        )


__all__ = ["HomeAssistantNotificationDelivery", "NotificationDelivery"]
