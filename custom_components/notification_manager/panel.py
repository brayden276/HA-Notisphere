"""Register the bundled Notification Manager panel."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from .const import (
    DATA_PANEL_STATIC_REGISTERED,
    DOMAIN,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_STATIC_URL,
    PANEL_TITLE,
    PANEL_URL_PATH,
)


async def async_register_panel(hass: Any) -> None:
    """Serve and register the bundled ES module."""

    bundle = Path(__file__).parent / "frontend" / "notification-manager-panel.js"
    if not bundle.is_file():
        raise FileNotFoundError(
            "Notification Manager panel bundle is missing from the installed component"
        )

    from homeassistant.components import panel_custom
    from homeassistant.components.http import StaticPathConfig

    module_url = await hass.async_add_executor_job(_panel_module_url, bundle)
    if not hass.data.get(DATA_PANEL_STATIC_REGISTERED):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(PANEL_STATIC_URL, str(bundle), True)]
        )
        hass.data[DATA_PANEL_STATIC_REGISTERED] = True
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=module_url,
        require_admin=False,
        config={"domain": DOMAIN},
        config_panel_domain=DOMAIN,
        handle_safe_area=True,
    )


def async_unregister_panel(hass: Any) -> None:
    """Remove the sidebar panel when the entry unloads."""

    from homeassistant.components import frontend

    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)


def _panel_module_url(bundle: Path) -> str:
    """Return a browser cache key derived from the packaged panel content."""

    with bundle.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()[:12]
    return f"{PANEL_STATIC_URL}?v={digest}"
