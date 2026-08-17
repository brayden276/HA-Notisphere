from pathlib import Path

from custom_components.notification_manager import panel
from custom_components.notification_manager.const import (
    INTEGRATION_VERSION,
    PANEL_STATIC_URL,
)


def test_packaged_panel_bundle_exists() -> None:
    bundle = Path(panel.__file__).parent / "frontend" / "notification-manager-panel.js"

    assert bundle.is_file()
    assert bundle.stat().st_size > 0


def test_panel_module_url_is_versioned() -> None:
    assert f"/{INTEGRATION_VERSION}/" in PANEL_STATIC_URL


def test_panel_module_url_changes_with_bundle_content(tmp_path: Path) -> None:
    bundle = tmp_path / "notification-manager-panel.js"
    bundle.write_text("first bundle", encoding="utf-8")
    first_url = panel._panel_module_url(bundle)

    bundle.write_text("second bundle", encoding="utf-8")
    second_url = panel._panel_module_url(bundle)

    assert first_url.startswith(f"{PANEL_STATIC_URL}?v=")
    assert first_url != second_url
