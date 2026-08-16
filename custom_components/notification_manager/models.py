"""Canonical, Home Assistant-independent domain models.

All collection fields are normalised to immutable values.  ``to_dict`` returns
fresh JSON-compatible structures so callers cannot mutate model state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from types import MappingProxyType
from typing import TypeAlias, cast

JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]
FrozenJson: TypeAlias = JsonScalar | tuple["FrozenJson", ...] | MappingProxyType

RULE_SCHEMA_VERSION = 1
STORAGE_SCHEMA_VERSION = 1


class RuleScope(StrEnum):
    PERSONAL = "PERSONAL"
    HOUSEHOLD = "HOUSEHOLD"


class TriggerType(StrEnum):
    BINARY_STATE = "BINARY_STATE"
    BINARY_STATE_DURATION = "BINARY_STATE_DURATION"
    NUMERIC_THRESHOLD = "NUMERIC_THRESHOLD"
    PRESENCE = "PRESENCE"
    TIME = "TIME"


class ConditionType(StrEnum):
    PERSON_HOME = "PERSON_HOME"
    PERSON_AWAY = "PERSON_AWAY"
    TIME_WINDOW = "TIME_WINDOW"
    ENTITY_STATE = "ENTITY_STATE"


class AudienceType(StrEnum):
    ME = "ME"
    RECIPIENT = "RECIPIENT"
    GROUP = "GROUP"
    EVERYONE = "EVERYONE"
    ADMINS = "ADMINS"


class EndpointType(StrEnum):
    HA_NOTIFY = "HA_NOTIFY"


class EndpointCapability(StrEnum):
    TITLE = "title"
    IMPORTANT = "important"
    CRITICAL = "critical"
    IMAGE = "image"
    ACTIONS = "actions"
    DEEP_LINK = "deep_link"
    REPLACEMENT = "replacement"
    SOUND = "sound"


class GroupType(StrEnum):
    CUSTOM = "CUSTOM"
    SYSTEM = "SYSTEM"


class SystemGroupType(StrEnum):
    EVERYONE = "EVERYONE"
    ADMINS = "ADMINS"


class Urgency(StrEnum):
    NORMAL = "NORMAL"
    IMPORTANT = "IMPORTANT"
    CRITICAL = "CRITICAL"


class RuleHealthStatus(StrEnum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    NEEDS_ATTENTION = "NEEDS_ATTENTION"


class ActivityStatus(StrEnum):
    SENT = "SENT"
    PARTIAL = "PARTIAL"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"
    TEST = "TEST"


class RecipientResultStatus(StrEnum):
    SENT = "SENT"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


def _freeze_json(value: JsonValue | FrozenJson) -> FrozenJson:
    if isinstance(value, MappingProxyType):
        return MappingProxyType({key: _freeze_json(item) for key, item in value.items()})
    if isinstance(value, dict):
        return MappingProxyType({str(key): _freeze_json(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze_json(item) for item in value)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise TypeError(f"Value is not JSON-compatible: {type(value).__name__}")


def _thaw_json(value: FrozenJson) -> JsonValue:
    if isinstance(value, MappingProxyType):
        return {str(key): _thaw_json(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_thaw_json(item) for item in value]
    return value


def _mapping(value: object, field_name: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} must be an object")
    return value


def _required_str(data: dict[str, object], name: str) -> str:
    value = data.get(name)
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string")
    return value


def _optional_str(data: dict[str, object], name: str) -> str | None:
    value = data.get(name)
    if value is not None and not isinstance(value, str):
        raise ValueError(f"{name} must be a string or null")
    return value


def _required_int(data: dict[str, object], name: str) -> int:
    value = data.get(name)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{name} must be an integer")
    return value


def _required_bool(data: dict[str, object], name: str) -> bool:
    value = data.get(name)
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be a boolean")
    return value


def _list(data: dict[str, object], name: str) -> list[object]:
    value = data.get(name)
    if not isinstance(value, list):
        raise ValueError(f"{name} must be an array")
    return value


def _parse_datetime(value: object, name: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"{name} must be an ISO 8601 string")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as err:
        raise ValueError(f"{name} must be a valid ISO 8601 datetime") from err
    return _utc_datetime(parsed, name)


def _utc_datetime(value: datetime, name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
    return value.astimezone(UTC)


def _datetime_json(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True, slots=True)
class TargetRef:
    entity_id: str
    domain: str
    display_name_snapshot: str
    registry_id: str | None = None
    device_id: str | None = None
    device_class: str | None = None

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "entity_id": self.entity_id,
            "registry_id": self.registry_id,
            "device_id": self.device_id,
            "domain": self.domain,
            "device_class": self.device_class,
            "display_name_snapshot": self.display_name_snapshot,
        }

    @classmethod
    def from_dict(cls, raw: object) -> TargetRef:
        data = _mapping(raw, "target")
        return cls(
            entity_id=_required_str(data, "entity_id"),
            registry_id=_optional_str(data, "registry_id"),
            device_id=_optional_str(data, "device_id"),
            domain=_required_str(data, "domain"),
            device_class=_optional_str(data, "device_class"),
            display_name_snapshot=_required_str(data, "display_name_snapshot"),
        )


@dataclass(frozen=True, slots=True)
class TriggerSpec:
    type: TriggerType
    target: TargetRef | None
    parameters: FrozenJson = field(default_factory=lambda: MappingProxyType({}))

    def __post_init__(self) -> None:
        object.__setattr__(self, "parameters", _freeze_json(self.parameters))

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "type": self.type.value,
            "target": self.target.to_dict() if self.target else None,
            "parameters": _thaw_json(self.parameters),
        }

    @classmethod
    def from_dict(cls, raw: object) -> TriggerSpec:
        data = _mapping(raw, "trigger")
        parameters = data.get("parameters", {})
        if not isinstance(parameters, dict):
            raise ValueError("parameters must be an object")
        target = data.get("target")
        return cls(
            type=TriggerType(_required_str(data, "type")),
            target=TargetRef.from_dict(target) if target is not None else None,
            parameters=cast(FrozenJson, parameters),
        )


@dataclass(frozen=True, slots=True)
class ConditionSpec:
    type: ConditionType
    target: TargetRef | None = None
    parameters: FrozenJson = field(default_factory=lambda: MappingProxyType({}))

    def __post_init__(self) -> None:
        object.__setattr__(self, "parameters", _freeze_json(self.parameters))

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "type": self.type.value,
            "target": self.target.to_dict() if self.target else None,
            "parameters": _thaw_json(self.parameters),
        }

    @classmethod
    def from_dict(cls, raw: object) -> ConditionSpec:
        data = _mapping(raw, "condition")
        parameters = data.get("parameters", {})
        if not isinstance(parameters, dict):
            raise ValueError("parameters must be an object")
        target = data.get("target")
        return cls(
            type=ConditionType(_required_str(data, "type")),
            target=TargetRef.from_dict(target) if target is not None else None,
            parameters=cast(FrozenJson, parameters),
        )


@dataclass(frozen=True, slots=True)
class Audience:
    type: AudienceType
    recipient_id: str | None = None
    group_id: str | None = None

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "type": self.type.value,
            "recipient_id": self.recipient_id,
            "group_id": self.group_id,
        }

    @classmethod
    def from_dict(cls, raw: object) -> Audience:
        data = _mapping(raw, "audience")
        return cls(
            type=AudienceType(_required_str(data, "type")),
            recipient_id=_optional_str(data, "recipient_id"),
            group_id=_optional_str(data, "group_id"),
        )


@dataclass(frozen=True, slots=True)
class NotificationAction:
    id: str
    title: str
    uri: str | None = None

    def to_dict(self) -> dict[str, JsonValue]:
        return {"id": self.id, "title": self.title, "uri": self.uri}

    @classmethod
    def from_dict(cls, raw: object) -> NotificationAction:
        data = _mapping(raw, "action")
        return cls(
            id=_required_str(data, "id"),
            title=_required_str(data, "title"),
            uri=_optional_str(data, "uri"),
        )


@dataclass(frozen=True, slots=True)
class NotificationContent:
    title: str
    message: str
    image_url: str | None = None
    deep_link: str | None = None
    actions: tuple[NotificationAction, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "actions", tuple(self.actions))

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "title": self.title,
            "message": self.message,
            "image_url": self.image_url,
            "deep_link": self.deep_link,
            "actions": [action.to_dict() for action in self.actions],
        }

    @classmethod
    def from_dict(cls, raw: object) -> NotificationContent:
        data = _mapping(raw, "content")
        return cls(
            title=_required_str(data, "title"),
            message=_required_str(data, "message"),
            image_url=_optional_str(data, "image_url"),
            deep_link=_optional_str(data, "deep_link"),
            actions=tuple(NotificationAction.from_dict(item) for item in _list(data, "actions")),
        )


@dataclass(frozen=True, slots=True)
class DeliveryPolicy:
    urgency: Urgency = Urgency.NORMAL
    deduplicate_endpoints: bool = True
    sound: str | None = None

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "urgency": self.urgency.value,
            "deduplicate_endpoints": self.deduplicate_endpoints,
            "sound": self.sound,
        }

    @classmethod
    def from_dict(cls, raw: object) -> DeliveryPolicy:
        data = _mapping(raw, "delivery_policy")
        return cls(
            urgency=Urgency(_required_str(data, "urgency")),
            deduplicate_endpoints=_required_bool(data, "deduplicate_endpoints"),
            sound=_optional_str(data, "sound"),
        )


@dataclass(frozen=True, slots=True)
class NotificationBehaviour:
    cooldown_seconds: int | None = None
    reminder_after_seconds: int | None = None
    repeat_every_seconds: int | None = None
    max_repeats: int | None = None
    stop_when_resolved: bool = False
    replace_previous: bool = False

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "cooldown_seconds": self.cooldown_seconds,
            "reminder_after_seconds": self.reminder_after_seconds,
            "repeat_every_seconds": self.repeat_every_seconds,
            "max_repeats": self.max_repeats,
            "stop_when_resolved": self.stop_when_resolved,
            "replace_previous": self.replace_previous,
        }

    @classmethod
    def from_dict(cls, raw: object) -> NotificationBehaviour:
        data = _mapping(raw, "behaviour")

        def optional_int(name: str) -> int | None:
            value = data.get(name)
            if value is not None and (not isinstance(value, int) or isinstance(value, bool)):
                raise ValueError(f"{name} must be an integer or null")
            return value

        return cls(
            cooldown_seconds=optional_int("cooldown_seconds"),
            reminder_after_seconds=optional_int("reminder_after_seconds"),
            repeat_every_seconds=optional_int("repeat_every_seconds"),
            max_repeats=optional_int("max_repeats"),
            stop_when_resolved=_required_bool(data, "stop_when_resolved"),
            replace_previous=_required_bool(data, "replace_previous"),
        )


@dataclass(frozen=True, slots=True)
class HealthIssue:
    code: str
    message: str
    reference: str | None = None

    def to_dict(self) -> dict[str, JsonValue]:
        return {"code": self.code, "message": self.message, "reference": self.reference}

    @classmethod
    def from_dict(cls, raw: object) -> HealthIssue:
        data = _mapping(raw, "health issue")
        return cls(
            code=_required_str(data, "code"),
            message=_required_str(data, "message"),
            reference=_optional_str(data, "reference"),
        )


@dataclass(frozen=True, slots=True)
class RuleHealth:
    status: RuleHealthStatus = RuleHealthStatus.HEALTHY
    issues: tuple[HealthIssue, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "issues", tuple(self.issues))

    def to_dict(self) -> dict[str, JsonValue]:
        return {"status": self.status.value, "issues": [issue.to_dict() for issue in self.issues]}

    @classmethod
    def from_dict(cls, raw: object) -> RuleHealth:
        data = _mapping(raw, "health")
        return cls(
            status=RuleHealthStatus(_required_str(data, "status")),
            issues=tuple(HealthIssue.from_dict(item) for item in _list(data, "issues")),
        )


@dataclass(frozen=True, slots=True)
class NotificationRule:
    id: str
    revision: int
    name: str
    enabled: bool
    owner_user_id: str
    scope: RuleScope
    trigger: TriggerSpec
    conditions: tuple[ConditionSpec, ...]
    audiences: tuple[Audience, ...]
    content: NotificationContent
    delivery_policy: DeliveryPolicy
    behaviour: NotificationBehaviour
    health: RuleHealth
    created_at: datetime
    updated_at: datetime
    schema_version: int = RULE_SCHEMA_VERSION

    def __post_init__(self) -> None:
        object.__setattr__(self, "conditions", tuple(self.conditions))
        object.__setattr__(self, "audiences", tuple(self.audiences))
        object.__setattr__(self, "created_at", _utc_datetime(self.created_at, "created_at"))
        object.__setattr__(self, "updated_at", _utc_datetime(self.updated_at, "updated_at"))

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "id": self.id,
            "revision": self.revision,
            "schema_version": self.schema_version,
            "name": self.name,
            "enabled": self.enabled,
            "owner_user_id": self.owner_user_id,
            "scope": self.scope.value,
            "trigger": self.trigger.to_dict(),
            "conditions": [condition.to_dict() for condition in self.conditions],
            "audiences": [audience.to_dict() for audience in self.audiences],
            "content": self.content.to_dict(),
            "delivery_policy": self.delivery_policy.to_dict(),
            "behaviour": self.behaviour.to_dict(),
            "health": self.health.to_dict(),
            "created_at": _datetime_json(self.created_at),
            "updated_at": _datetime_json(self.updated_at),
        }

    @classmethod
    def from_dict(cls, raw: object) -> NotificationRule:
        data = _mapping(raw, "rule")
        return cls(
            id=_required_str(data, "id"),
            revision=_required_int(data, "revision"),
            schema_version=_required_int(data, "schema_version"),
            name=_required_str(data, "name"),
            enabled=_required_bool(data, "enabled"),
            owner_user_id=_required_str(data, "owner_user_id"),
            scope=RuleScope(_required_str(data, "scope")),
            trigger=TriggerSpec.from_dict(data.get("trigger")),
            conditions=tuple(ConditionSpec.from_dict(item) for item in _list(data, "conditions")),
            audiences=tuple(Audience.from_dict(item) for item in _list(data, "audiences")),
            content=NotificationContent.from_dict(data.get("content")),
            delivery_policy=DeliveryPolicy.from_dict(data.get("delivery_policy")),
            behaviour=NotificationBehaviour.from_dict(data.get("behaviour")),
            health=RuleHealth.from_dict(data.get("health")),
            created_at=_parse_datetime(data.get("created_at"), "created_at"),
            updated_at=_parse_datetime(data.get("updated_at"), "updated_at"),
        )


@dataclass(frozen=True, slots=True)
class DeliveryEndpoint:
    id: str
    type: EndpointType
    target: str
    platform: str
    capabilities: frozenset[EndpointCapability] = frozenset()
    enabled: bool = True
    priority: int = 0

    def __post_init__(self) -> None:
        object.__setattr__(self, "capabilities", frozenset(self.capabilities))

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "id": self.id,
            "type": self.type.value,
            "target": self.target,
            "platform": self.platform,
            "capabilities": cast(
                JsonValue, sorted(capability.value for capability in self.capabilities)
            ),
            "enabled": self.enabled,
            "priority": self.priority,
        }

    @classmethod
    def from_dict(cls, raw: object) -> DeliveryEndpoint:
        data = _mapping(raw, "endpoint")
        return cls(
            id=_required_str(data, "id"),
            type=EndpointType(_required_str(data, "type")),
            target=_required_str(data, "target"),
            platform=_required_str(data, "platform"),
            capabilities=frozenset(
                EndpointCapability(str(item)) for item in _list(data, "capabilities")
            ),
            enabled=_required_bool(data, "enabled"),
            priority=_required_int(data, "priority"),
        )


@dataclass(frozen=True, slots=True)
class RecipientPreferences:
    preferred_endpoint_id: str | None = None
    allow_critical: bool = True

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "preferred_endpoint_id": self.preferred_endpoint_id,
            "allow_critical": self.allow_critical,
        }

    @classmethod
    def from_dict(cls, raw: object) -> RecipientPreferences:
        data = _mapping(raw, "preferences")
        return cls(
            preferred_endpoint_id=_optional_str(data, "preferred_endpoint_id"),
            allow_critical=_required_bool(data, "allow_critical"),
        )


@dataclass(frozen=True, slots=True)
class RecipientProfile:
    id: str
    ha_user_id: str
    display_name: str
    endpoints: tuple[DeliveryEndpoint, ...] = ()
    preferences: RecipientPreferences = RecipientPreferences()
    person_entity_id: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "endpoints", tuple(self.endpoints))

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "id": self.id,
            "ha_user_id": self.ha_user_id,
            "person_entity_id": self.person_entity_id,
            "display_name": self.display_name,
            "endpoints": [endpoint.to_dict() for endpoint in self.endpoints],
            "preferences": self.preferences.to_dict(),
        }

    @classmethod
    def from_dict(cls, raw: object) -> RecipientProfile:
        data = _mapping(raw, "recipient")
        return cls(
            id=_required_str(data, "id"),
            ha_user_id=_required_str(data, "ha_user_id"),
            person_entity_id=_optional_str(data, "person_entity_id"),
            display_name=_required_str(data, "display_name"),
            endpoints=tuple(DeliveryEndpoint.from_dict(item) for item in _list(data, "endpoints")),
            preferences=RecipientPreferences.from_dict(data.get("preferences")),
        )


@dataclass(frozen=True, slots=True)
class RecipientGroup:
    id: str
    name: str
    type: GroupType
    member_recipient_ids: tuple[str, ...] = ()
    system_type: SystemGroupType | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "member_recipient_ids", tuple(self.member_recipient_ids))

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value,
            "member_recipient_ids": list(self.member_recipient_ids),
            "system_type": self.system_type.value if self.system_type else None,
        }

    @classmethod
    def from_dict(cls, raw: object) -> RecipientGroup:
        data = _mapping(raw, "group")
        system_type = _optional_str(data, "system_type")
        members = _list(data, "member_recipient_ids")
        if not all(isinstance(item, str) for item in members):
            raise ValueError("member_recipient_ids must contain only strings")
        return cls(
            id=_required_str(data, "id"),
            name=_required_str(data, "name"),
            type=GroupType(_required_str(data, "type")),
            member_recipient_ids=tuple(cast(list[str], members)),
            system_type=SystemGroupType(system_type) if system_type else None,
        )


@dataclass(frozen=True, slots=True)
class RecipientResult:
    recipient_id: str
    recipient_name: str
    endpoint_id: str | None
    endpoint_name: str | None
    status: RecipientResultStatus
    reason: str | None = None

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "recipient_id": self.recipient_id,
            "recipient_name": self.recipient_name,
            "endpoint_id": self.endpoint_id,
            "endpoint_name": self.endpoint_name,
            "status": self.status.value,
            "reason": self.reason,
        }

    @classmethod
    def from_dict(cls, raw: object) -> RecipientResult:
        data = _mapping(raw, "recipient result")
        return cls(
            recipient_id=_required_str(data, "recipient_id"),
            recipient_name=_required_str(data, "recipient_name"),
            endpoint_id=_optional_str(data, "endpoint_id"),
            endpoint_name=_optional_str(data, "endpoint_name"),
            status=RecipientResultStatus(_required_str(data, "status")),
            reason=_optional_str(data, "reason"),
        )


@dataclass(frozen=True, slots=True)
class ActivityRecord:
    id: str
    rule_id: str
    occurrence_id: str
    timestamp: datetime
    trigger_summary: str
    status: ActivityStatus
    recipient_results: tuple[RecipientResult, ...] = ()
    reason: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "recipient_results", tuple(self.recipient_results))
        object.__setattr__(self, "timestamp", _utc_datetime(self.timestamp, "timestamp"))

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "id": self.id,
            "rule_id": self.rule_id,
            "occurrence_id": self.occurrence_id,
            "timestamp": _datetime_json(self.timestamp),
            "trigger_summary": self.trigger_summary,
            "status": self.status.value,
            "recipient_results": [result.to_dict() for result in self.recipient_results],
            "reason": self.reason,
        }

    @classmethod
    def from_dict(cls, raw: object) -> ActivityRecord:
        data = _mapping(raw, "activity record")
        return cls(
            id=_required_str(data, "id"),
            rule_id=_required_str(data, "rule_id"),
            occurrence_id=_required_str(data, "occurrence_id"),
            timestamp=_parse_datetime(data.get("timestamp"), "timestamp"),
            trigger_summary=_required_str(data, "trigger_summary"),
            status=ActivityStatus(_required_str(data, "status")),
            recipient_results=tuple(
                RecipientResult.from_dict(item) for item in _list(data, "recipient_results")
            ),
            reason=_optional_str(data, "reason"),
        )
