from pathlib import Path

from custom_components.notification_manager import panel
from custom_components.notification_manager.const import (
    INTEGRATION_VERSION,
    PANEL_MODULE_URL,
    PANEL_STATIC_URL,
)


def test_packaged_panel_bundle_exists() -> None:
    bundle = Path(panel.__file__).parent / "frontend" / "notification-manager-panel.js"

    assert bundle.is_file()
    assert bundle.stat().st_size > 0


def test_panel_module_url_is_versioned() -> None:
    assert f"{PANEL_STATIC_URL}?v={INTEGRATION_VERSION}" == PANEL_MODULE_URL
