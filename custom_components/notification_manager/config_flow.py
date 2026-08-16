"""Config flow for Notification Manager."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class NotificationManagerConfigFlow(ConfigFlow, domain=DOMAIN):  # type: ignore[call-arg]
    """Create the single local Notification Manager config entry."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the no-input setup confirmation."""

        if self._async_current_entries():
            return self.async_abort(reason="already_configured")
        if user_input is not None:
            return self.async_create_entry(title="Notification Manager", data={})
        return self.async_show_form(step_id="user")
