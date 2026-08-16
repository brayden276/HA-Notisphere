"""Authenticated WebSocket API for Notification Manager."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api

from .capabilities import CapabilityRegistryError
from .capabilities.registry import SYNTHETIC_TIME_TARGET
from .const import (
    DATA_MANAGER,
    DATA_WEBSOCKET_REGISTERED,
    DEFAULT_ACTIVITY_PAGE_SIZE,
    DOMAIN,
    MAX_ACTIVITY_PAGE_SIZE,
)
from .manager import (
    NotificationManager,
    PermissionDeniedError,
    RequestUser,
    RuntimeUnavailableError,
)
from .models import ActivityStatus, NotificationRule, RecipientGroup, RecipientProfile
from .recipients.manager import RecipientServiceError
from .storage import RevisionConflictError, RuleNotFoundError
from .validation import DomainValidationError, ValidationIssue


def _manager(hass: Any) -> NotificationManager:
    entries = hass.data[DOMAIN]
    for value in entries.values():
        return value[DATA_MANAGER]
    raise RuntimeError("Notification Manager has no loaded config entry")


def _user(connection: Any) -> RequestUser:
    return RequestUser(
        id=connection.user.id,
        name=connection.user.name or "",
        is_admin=connection.user.is_admin,
        entity_permission=lambda entity_id: connection.user.permissions.check_entity(
            entity_id, POLICY_READ
        ),
    )


def _send_error(connection: Any, message_id: int, err: Exception) -> None:
    if isinstance(err, DomainValidationError):
        connection.send_error(
            message_id,
            "validation_error",
            "This notification has invalid settings.",
            error={
                "issues": [
                    {"path": issue.path, "code": issue.code, "message": issue.message}
                    for issue in err.issues
                ]
            },
        )
    elif isinstance(err, RevisionConflictError):
        connection.send_error(
            message_id,
            "conflict",
            "This notification changed while you were editing it.",
            error={
                "expected_revision": err.expected_revision,
                "actual_revision": err.actual_revision,
            },
        )
    elif isinstance(err, RuleNotFoundError):
        connection.send_error(message_id, "not_found", "Notification not found.")
    elif isinstance(
        err,
        (
            PermissionDeniedError,
            RecipientServiceError,
            CapabilityRegistryError,
            RuntimeUnavailableError,
        ),
    ):
        connection.send_error(message_id, err.code, str(err))
    else:
        raise err


def _parse_rule(raw: object) -> NotificationRule:
    try:
        return NotificationRule.from_dict(raw)
    except ValueError as err:
        raise DomainValidationError(
            (ValidationIssue("rule", "invalid_format", str(err)),)
        ) from err


def _parse_recipient(raw: object) -> RecipientProfile:
    try:
        return RecipientProfile.from_dict(raw)
    except ValueError as err:
        raise DomainValidationError(
            (ValidationIssue("recipient", "invalid_format", str(err)),)
        ) from err


def _parse_group(raw: object) -> RecipientGroup:
    try:
        return RecipientGroup.from_dict(raw)
    except ValueError as err:
        raise DomainValidationError(
            (ValidationIssue("group", "invalid_format", str(err)),)
        ) from err


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/bootstrap"})
@websocket_api.async_response
async def ws_bootstrap(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    connection.send_result(msg["id"], await _manager(hass).bootstrap(_user(connection)))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/rules/list"})
@websocket_api.async_response
async def ws_rules_list(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    rules = await _manager(hass).list_rules(_user(connection))
    connection.send_result(msg["id"], [rule.to_dict() for rule in rules])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/rules/get", vol.Required("rule_id"): str}
)
@websocket_api.async_response
async def ws_rules_get(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    try:
        rule = await _manager(hass).get_rule(msg["rule_id"], _user(connection))
        connection.send_result(msg["id"], rule.to_dict())
    except (PermissionDeniedError, RuleNotFoundError) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/rules/create", vol.Required("rule"): dict}
)
@websocket_api.async_response
async def ws_rules_create(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    try:
        rule = _parse_rule(msg["rule"])
        saved = await _manager(hass).create_rule(rule, _user(connection))
        connection.send_result(msg["id"], saved.to_dict())
    except (DomainValidationError, PermissionDeniedError, RevisionConflictError) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/rules/update",
        vol.Required("rule"): dict,
        vol.Required("expected_revision"): int,
    }
)
@websocket_api.async_response
async def ws_rules_update(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    try:
        rule = _parse_rule(msg["rule"])
        saved = await _manager(hass).update_rule(
            rule, msg["expected_revision"], _user(connection)
        )
        connection.send_result(msg["id"], saved.to_dict())
    except (
        DomainValidationError,
        PermissionDeniedError,
        RevisionConflictError,
        RuleNotFoundError,
    ) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/rules/delete",
        vol.Required("rule_id"): str,
        vol.Required("expected_revision"): int,
    }
)
@websocket_api.async_response
async def ws_rules_delete(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    try:
        await _manager(hass).delete_rule(
            msg["rule_id"], msg["expected_revision"], _user(connection)
        )
        connection.send_result(msg["id"])
    except (PermissionDeniedError, RevisionConflictError, RuleNotFoundError) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/rules/set_enabled",
        vol.Required("rule_id"): str,
        vol.Required("enabled"): bool,
        vol.Required("expected_revision"): int,
    }
)
@websocket_api.async_response
async def ws_rules_set_enabled(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    try:
        saved = await _manager(hass).set_rule_enabled(
            msg["rule_id"],
            msg["enabled"],
            msg["expected_revision"],
            _user(connection),
        )
        connection.send_result(msg["id"], saved.to_dict())
    except (PermissionDeniedError, RevisionConflictError, RuleNotFoundError) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/rules/test",
        vol.Exclusive("rule_id", "test_target"): str,
        vol.Exclusive("rule", "test_target"): dict,
    }
)
@websocket_api.async_response
async def ws_rules_test(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    try:
        manager = _manager(hass)
        if "rule" in msg:
            record = await manager.test_rule_draft(
                _parse_rule(msg["rule"]), _user(connection)
            )
        elif "rule_id" in msg:
            record = await manager.test_rule(msg["rule_id"], _user(connection))
        else:
            raise DomainValidationError(
                (ValidationIssue("rule", "required", "A notification is required."),)
            )
        connection.send_result(msg["id"], record.to_dict())
    except (
        DomainValidationError,
        PermissionDeniedError,
        RuleNotFoundError,
        RuntimeUnavailableError,
    ) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/recipients/list"})
@websocket_api.async_response
async def ws_recipients_list(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    recipients = await _manager(hass).list_recipients(_user(connection))
    connection.send_result(msg["id"], [item.to_dict() for item in recipients])


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/recipients/update", vol.Required("recipient"): dict}
)
@websocket_api.async_response
async def ws_recipients_update(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    try:
        manager = _manager(hass)
        recipient = _parse_recipient(msg["recipient"])
        saved = await manager.recipients.update_recipient(recipient, _user(connection))
        await manager.async_reconcile_health()
        connection.send_result(msg["id"], saved.to_dict())
    except (DomainValidationError, RecipientServiceError) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/recipients/test", vol.Required("recipient_id"): str}
)
@websocket_api.async_response
async def ws_recipients_test(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    manager = _manager(hass)
    if manager.recipient_delivery is None:
        connection.send_error(msg["id"], "delivery_unavailable", "Delivery is unavailable.")
        return
    try:
        result = await manager.recipients.test_notification(
            msg["recipient_id"], _user(connection), manager.recipient_delivery
        )
        connection.send_result(msg["id"], result.to_dict())
    except RecipientServiceError as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/recipients/confirm",
        vol.Required("source"): str,
        vol.Required("recipient_id"): str,
    }
)
@websocket_api.async_response
async def ws_recipients_confirm(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    try:
        saved = await _manager(hass).confirm_discovery_mapping(
            msg["source"], msg["recipient_id"], _user(connection)
        )
        connection.send_result(msg["id"], saved.to_dict())
    except (PermissionDeniedError, RecipientServiceError) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/groups/list"})
@websocket_api.async_response
async def ws_groups_list(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    groups = await _manager(hass).recipients.list_groups()
    connection.send_result(msg["id"], [item.to_dict() for item in groups])


async def _handle_group_write(
    hass: Any, connection: Any, msg: dict[str, Any], operation: str
) -> None:
    try:
        group = _parse_group(msg["group"])
        manager = _manager(hass)
        recipient_manager = manager.recipients
        saved = (
            await recipient_manager.create_group(group, _user(connection))
            if operation == "create"
            else await recipient_manager.update_group(group, _user(connection))
        )
        await manager.async_reconcile_health()
        connection.send_result(msg["id"], saved.to_dict())
    except (DomainValidationError, RecipientServiceError) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/groups/create", vol.Required("group"): dict}
)
@websocket_api.async_response
async def ws_groups_create(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    await _handle_group_write(hass, connection, msg, "create")


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/groups/update", vol.Required("group"): dict}
)
@websocket_api.async_response
async def ws_groups_update(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    await _handle_group_write(hass, connection, msg, "update")


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/groups/delete", vol.Required("group_id"): str}
)
@websocket_api.async_response
async def ws_groups_delete(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    try:
        manager = _manager(hass)
        await manager.recipients.delete_group(msg["group_id"], _user(connection))
        await manager.async_reconcile_health()
        connection.send_result(msg["id"])
    except RecipientServiceError as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/capabilities/targets"}
)
@websocket_api.async_response
async def ws_capability_targets(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    discovery = _manager(hass).capability_discovery
    targets = await discovery.async_targets() if discovery is not None else ()
    user = _user(connection)
    targets = tuple(
        target
        for target in targets
        if target.synthetic or user.can_read_entity(target.entity_id)
    )
    connection.send_result(msg["id"], [item.to_dict() for item in targets])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/capabilities/for_target",
        vol.Required("entity_id"): str,
    }
)
@websocket_api.async_response
async def ws_capability_for_target(
    hass: Any, connection: Any, msg: dict[str, Any]
) -> None:
    discovery = _manager(hass).capability_discovery
    if discovery is None:
        connection.send_error(
            msg["id"], "capabilities_unavailable", "Capabilities are unavailable."
        )
        return
    try:
        if (
            msg["entity_id"] != SYNTHETIC_TIME_TARGET
            and not _user(connection).can_read_entity(msg["entity_id"])
        ):
            raise PermissionDeniedError(
                "You do not have access to that Home Assistant device."
            )
        target = await discovery.async_for_target(msg["entity_id"])
        connection.send_result(msg["id"], target.to_dict())
    except (CapabilityRegistryError, PermissionDeniedError) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/capabilities/resolve",
        vol.Required("entity_id"): str,
        vol.Required("semantic"): str,
        vol.Optional("parameters", default={}): dict,
    }
)
@websocket_api.async_response
async def ws_capability_resolve(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    discovery = _manager(hass).capability_discovery
    if discovery is None:
        connection.send_error(
            msg["id"], "capabilities_unavailable", "Capabilities are unavailable."
        )
        return
    try:
        if (
            msg["entity_id"] != SYNTHETIC_TIME_TARGET
            and not _user(connection).can_read_entity(msg["entity_id"])
        ):
            raise PermissionDeniedError(
                "You do not have access to that Home Assistant device."
            )
        trigger = await discovery.async_resolve(
            msg["entity_id"], msg["semantic"], msg["parameters"]
        )
        connection.send_result(msg["id"], trigger.to_dict())
    except (CapabilityRegistryError, PermissionDeniedError) as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/activity/list",
        vol.Optional("rule_id"): str,
        vol.Optional("recipient_id"): str,
        vol.Optional("status"): vol.In(tuple(item.value for item in ActivityStatus)),
        vol.Optional("limit", default=DEFAULT_ACTIVITY_PAGE_SIZE): vol.All(
            int, vol.Range(min=1, max=MAX_ACTIVITY_PAGE_SIZE)
        ),
    }
)
@websocket_api.async_response
async def ws_activity_list(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    service = _manager(hass).observability
    if service is None:
        connection.send_error(msg["id"], "activity_unavailable", "Activity is unavailable.")
        return
    status = ActivityStatus(msg["status"]) if "status" in msg else None
    records = await service.list_activity(
        _user(connection),
        rule_id=msg.get("rule_id"),
        recipient_id=msg.get("recipient_id"),
        status=status,
        limit=msg["limit"],
    )
    connection.send_result(msg["id"], [record.to_dict() for record in records])


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/settings/get"})
@websocket_api.async_response
async def ws_settings_get(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    service = _manager(hass).observability
    if service is None:
        connection.send_error(msg["id"], "settings_unavailable", "Settings are unavailable.")
        return
    try:
        user = _user(connection)
        settings = await service.get_settings(user)
        diagnostics = await service.diagnostics(user)
        connection.send_result(
            msg["id"],
            {
                "activity_retention": settings.to_dict(),
                "diagnostics": diagnostics.to_dict(),
            },
        )
    except PermissionDeniedError as err:
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/settings/update",
        vol.Required("activity_retention_days"): int,
        vol.Required("activity_retention_records"): int,
    }
)
@websocket_api.async_response
async def ws_settings_update(hass: Any, connection: Any, msg: dict[str, Any]) -> None:
    service = _manager(hass).observability
    if service is None:
        connection.send_error(msg["id"], "settings_unavailable", "Settings are unavailable.")
        return
    try:
        settings = await service.update_settings(
            _user(connection),
            activity_retention_days=msg["activity_retention_days"],
            activity_retention_records=msg["activity_retention_records"],
        )
        connection.send_result(msg["id"], settings.to_dict())
    except PermissionDeniedError as err:
        _send_error(connection, msg["id"], err)
    except ValueError as err:
        _send_error(
            connection,
            msg["id"],
            DomainValidationError(
                (ValidationIssue("activity_retention", "invalid_value", str(err)),)
            ),
        )


COMMANDS = (
    ws_bootstrap,
    ws_rules_list,
    ws_rules_get,
    ws_rules_create,
    ws_rules_update,
    ws_rules_delete,
    ws_rules_set_enabled,
    ws_rules_test,
    ws_recipients_list,
    ws_recipients_update,
    ws_recipients_test,
    ws_recipients_confirm,
    ws_groups_list,
    ws_groups_create,
    ws_groups_update,
    ws_groups_delete,
    ws_capability_targets,
    ws_capability_for_target,
    ws_capability_resolve,
    ws_activity_list,
    ws_settings_get,
    ws_settings_update,
)


def async_register_websocket_commands(hass: Any) -> None:
    """Register commands once across config-entry reloads."""

    if hass.data.get(DATA_WEBSOCKET_REGISTERED):
        return
    for command in COMMANDS:
        websocket_api.async_register_command(hass, command)
    hass.data[DATA_WEBSOCKET_REGISTERED] = True
