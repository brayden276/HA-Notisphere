from __future__ import annotations

import json
from pathlib import Path

COMPONENT = Path("custom_components/notification_manager")


def test_manifest_and_custom_translation_contract() -> None:
    manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
    translation = json.loads(
        (COMPONENT / "translations/en.json").read_text(encoding="utf-8")
    )

    assert manifest["domain"] == "notification_manager"
    assert manifest["config_flow"] is True
    assert manifest["single_config_entry"] is True
    assert manifest["version"]
    assert translation["title"] == "Notification Manager"
    assert not (COMPONENT / "strings.json").exists()


def test_panel_bundle_target_is_inside_installable_component() -> None:
    panel_source = (COMPONENT / "panel.py").read_text(encoding="utf-8")
    assert 'Path(__file__).parent / "frontend"' in panel_source

