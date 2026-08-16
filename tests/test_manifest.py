from __future__ import annotations

import json
import tomllib
from pathlib import Path

from custom_components.notification_manager.const import INTEGRATION_VERSION

COMPONENT = Path("custom_components/notification_manager")


def test_manifest_and_custom_translation_contract() -> None:
    manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
    translation = json.loads(
        (COMPONENT / "translations/en.json").read_text(encoding="utf-8")
    )
    strings = json.loads((COMPONENT / "strings.json").read_text(encoding="utf-8"))
    project = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))

    assert manifest["domain"] == "notification_manager"
    assert manifest["config_flow"] is True
    assert manifest["single_config_entry"] is True
    assert manifest["version"] == INTEGRATION_VERSION
    assert project["project"]["version"] == INTEGRATION_VERSION
    assert translation["title"] == "Notification Manager"
    assert strings == translation


def test_panel_bundle_target_is_inside_installable_component() -> None:
    panel_source = (COMPONENT / "panel.py").read_text(encoding="utf-8")
    assert 'Path(__file__).parent / "frontend"' in panel_source
