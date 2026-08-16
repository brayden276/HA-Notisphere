"""Constants for Notification Manager."""

from typing import Final

DOMAIN: Final = "notification_manager"
INTEGRATION_VERSION: Final = "0.1.0"
DATA_MANAGER: Final = "manager"
DATA_WEBSOCKET_REGISTERED: Final = f"{DOMAIN}_websocket_registered"
DATA_PANEL_STATIC_REGISTERED: Final = f"{DOMAIN}_panel_static_registered"
STORAGE_KEY: Final = f"{DOMAIN}.state"
STORAGE_VERSION: Final = 1

PANEL_URL_PATH: Final = "notification-manager"
PANEL_ELEMENT: Final = "notification-manager-panel"
PANEL_TITLE: Final = "Notifications"
PANEL_ICON: Final = "mdi:bell-outline"
PANEL_STATIC_URL: Final = f"/api/{DOMAIN}/frontend/notification-manager-panel.js"

WS_PREFIX: Final = f"{DOMAIN}/"
SIGNAL_UPDATED: Final = f"{DOMAIN}_updated"
