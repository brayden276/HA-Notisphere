"""Pure recipient, group and audience application service."""

from __future__ import annotations

from ..models import (
    Audience,
    DeliveryEndpoint,
    EndpointCapability,
    GroupType,
    NotificationContent,
    RecipientGroup,
    RecipientProfile,
    RecipientResult,
    RecipientResultStatus,
    SystemGroupType,
)
from ..storage import RuleRepository
from ..validation import require_valid_group, require_valid_recipient
from .delivery import NotificationDelivery
from .resolver import (
    AudienceResolution,
    RequestIdentity,
    SkippedDelivery,
    primary_endpoint,
    resolve_audiences,
)

SYSTEM_EVERYONE_GROUP_ID = "system:everyone"
SYSTEM_ADMINS_GROUP_ID = "system:admins"


class RecipientServiceError(RuntimeError):
    """Base class for transport-neutral recipient service errors."""

    code = "recipient_error"


class RecipientPermissionDeniedError(RecipientServiceError):
    code = "permission_denied"


class RecipientNotFoundError(RecipientServiceError):
    code = "recipient_not_found"

    def __init__(self, recipient_id: str) -> None:
        self.recipient_id = recipient_id
        super().__init__(f"Recipient {recipient_id!r} does not exist")


class RecipientConflictError(RecipientServiceError):
    code = "recipient_conflict"


class GroupNotFoundError(RecipientServiceError):
    code = "group_not_found"

    def __init__(self, group_id: str) -> None:
        self.group_id = group_id
        super().__init__(f"Recipient group {group_id!r} does not exist")


class GroupConflictError(RecipientServiceError):
    code = "group_conflict"


SYSTEM_GROUPS = (
    RecipientGroup(
        id=SYSTEM_EVERYONE_GROUP_ID,
        name="Everyone",
        type=GroupType.SYSTEM,
        system_type=SystemGroupType.EVERYONE,
    ),
    RecipientGroup(
        id=SYSTEM_ADMINS_GROUP_ID,
        name="Admins",
        type=GroupType.SYSTEM,
        system_type=SystemGroupType.ADMINS,
    ),
)


class RecipientManager:
    """Manage recipient mappings and resolve audiences without Home Assistant imports."""

    def __init__(self, repository: RuleRepository) -> None:
        self._repository = repository

    async def list_recipients(self) -> tuple[RecipientProfile, ...]:
        snapshot = await self._repository.snapshot()
        return tuple(
            sorted(snapshot.recipients, key=lambda item: (item.display_name.casefold(), item.id))
        )

    async def get_recipient(self, recipient_id: str) -> RecipientProfile:
        recipient = next(
            (item for item in await self.list_recipients() if item.id == recipient_id), None
        )
        if recipient is None:
            raise RecipientNotFoundError(recipient_id)
        return recipient

    async def update_recipient(
        self, recipient: RecipientProfile, user: RequestIdentity
    ) -> RecipientProfile:
        """Update a discovered recipient mapping; users may only update their own mapping."""

        require_valid_recipient(recipient)
        self._require_mobile_app_targets(recipient)
        snapshot = await self._repository.snapshot()
        existing = next((item for item in snapshot.recipients if item.id == recipient.id), None)
        if existing is None:
            raise RecipientNotFoundError(recipient.id)
        if not user.is_admin and existing.ha_user_id != user.id:
            raise RecipientPermissionDeniedError("You can only change your own recipient mapping.")
        if not user.is_admin and recipient.ha_user_id != existing.ha_user_id:
            raise RecipientPermissionDeniedError("You cannot reassign a recipient mapping.")

        recipients = tuple(
            recipient if item.id == recipient.id else item for item in snapshot.recipients
        )
        self._require_unique_recipients(recipients)
        await self._repository.replace_recipients(recipients)
        return recipient

    async def replace_discovered_recipients(
        self, recipients: tuple[RecipientProfile, ...]
    ) -> None:
        """Replace discovery state after applying cross-recipient invariants."""

        self._require_unique_recipients(recipients)
        for recipient in recipients:
            require_valid_recipient(recipient)
            self._require_mobile_app_targets(recipient)
        await self._repository.replace_recipients(recipients)

    async def list_groups(self) -> tuple[RecipientGroup, ...]:
        custom = tuple(
            group
            for group in (await self._repository.snapshot()).groups
            if group.type is GroupType.CUSTOM
        )
        return (*SYSTEM_GROUPS, *sorted(custom, key=lambda item: (item.name.casefold(), item.id)))

    async def create_group(
        self, group: RecipientGroup, user: RequestIdentity
    ) -> RecipientGroup:
        self._require_admin(user)
        self._require_custom_group(group)
        snapshot = await self._repository.snapshot()
        if any(existing.id == group.id for existing in (*SYSTEM_GROUPS, *snapshot.groups)):
            raise GroupConflictError(f"Recipient group {group.id!r} already exists")
        self._validate_group_members(group, snapshot.recipients)
        await self._repository.replace_groups((*snapshot.groups, group))
        return group

    async def update_group(
        self, group: RecipientGroup, user: RequestIdentity
    ) -> RecipientGroup:
        self._require_admin(user)
        self._require_custom_group(group)
        snapshot = await self._repository.snapshot()
        existing = next((item for item in snapshot.groups if item.id == group.id), None)
        if existing is None:
            raise GroupNotFoundError(group.id)
        if existing.type is not GroupType.CUSTOM:
            raise GroupConflictError("System groups cannot be changed")
        self._validate_group_members(group, snapshot.recipients)
        groups = tuple(group if item.id == group.id else item for item in snapshot.groups)
        await self._repository.replace_groups(groups)
        return group

    async def delete_group(self, group_id: str, user: RequestIdentity) -> None:
        self._require_admin(user)
        if group_id in {item.id for item in SYSTEM_GROUPS}:
            raise GroupConflictError("System groups cannot be deleted")
        snapshot = await self._repository.snapshot()
        if not any(item.id == group_id for item in snapshot.groups):
            raise GroupNotFoundError(group_id)
        await self._repository.replace_groups(
            tuple(item for item in snapshot.groups if item.id != group_id)
        )

    def primary_endpoint(
        self,
        recipient: RecipientProfile,
        required_capabilities: frozenset[EndpointCapability] = frozenset(),
    ) -> tuple[DeliveryEndpoint | None, SkippedDelivery | None]:
        return primary_endpoint(recipient, required_capabilities)

    async def test_notification(
        self,
        recipient_id: str,
        user: RequestIdentity,
        delivery: NotificationDelivery,
    ) -> RecipientResult:
        """Send a simple test through the recipient's current primary endpoint."""

        recipient = await self.get_recipient(recipient_id)
        if not user.is_admin and recipient.ha_user_id != user.id:
            raise RecipientPermissionDeniedError(
                "You can only test your own recipient mapping."
            )
        endpoint, skipped = self.primary_endpoint(recipient)
        if endpoint is None:
            return RecipientResult(
                recipient.id,
                recipient.display_name,
                None,
                None,
                RecipientResultStatus.SKIPPED,
                skipped.detail if skipped is not None else "No usable endpoint.",
            )
        try:
            await delivery.async_send(
                endpoint,
                NotificationContent(
                    title="Notification Manager test",
                    message="Your notification endpoint is working.",
                ),
            )
        except Exception as err:
            return RecipientResult(
                recipient.id,
                recipient.display_name,
                endpoint.id,
                endpoint.target,
                RecipientResultStatus.FAILED,
                str(err) or type(err).__name__,
            )
        return RecipientResult(
            recipient.id,
            recipient.display_name,
            endpoint.id,
            endpoint.target,
            RecipientResultStatus.SENT,
        )

    async def resolve_audiences(
        self,
        audiences: tuple[Audience, ...],
        current_user: RequestIdentity,
        directory_users: tuple[RequestIdentity, ...],
        required_capabilities: frozenset[EndpointCapability] = frozenset(),
    ) -> AudienceResolution:
        """Expand overlapping audiences and deduplicate their physical notify targets."""

        snapshot = await self._repository.snapshot()
        return resolve_audiences(
            audiences,
            snapshot.recipients,
            (*SYSTEM_GROUPS, *snapshot.groups),
            current_user,
            directory_users,
            required_capabilities,
        )

    @staticmethod
    def _require_admin(user: RequestIdentity) -> None:
        if not user.is_admin:
            raise RecipientPermissionDeniedError(
                "Only an administrator can change recipient groups."
            )

    @staticmethod
    def _require_custom_group(group: RecipientGroup) -> None:
        require_valid_group(group)
        if group.type is not GroupType.CUSTOM or group.system_type is not None:
            raise GroupConflictError("Only custom recipient groups can be stored")

    @staticmethod
    def _validate_group_members(
        group: RecipientGroup, recipients: tuple[RecipientProfile, ...]
    ) -> None:
        recipient_ids = {item.id for item in recipients}
        missing = sorted(set(group.member_recipient_ids) - recipient_ids)
        if missing:
            raise RecipientNotFoundError(missing[0])

    @staticmethod
    def _require_unique_recipients(recipients: tuple[RecipientProfile, ...]) -> None:
        ids = [item.id for item in recipients]
        user_ids = [item.ha_user_id for item in recipients]
        if len(set(ids)) != len(ids):
            raise RecipientConflictError("Recipient IDs must be unique")
        if len(set(user_ids)) != len(user_ids):
            raise RecipientConflictError("Each Home Assistant user can have only one recipient")

    @staticmethod
    def _require_mobile_app_targets(recipient: RecipientProfile) -> None:
        for endpoint in recipient.endpoints:
            if not endpoint.target.startswith("notify.mobile_app_"):
                raise RecipientConflictError(
                    f"Endpoint {endpoint.id!r} must target a notify.mobile_app_* service"
                )


__all__ = [
    "SYSTEM_ADMINS_GROUP_ID",
    "SYSTEM_EVERYONE_GROUP_ID",
    "SYSTEM_GROUPS",
    "AudienceResolution",
    "GroupConflictError",
    "GroupNotFoundError",
    "RecipientConflictError",
    "RecipientManager",
    "RecipientNotFoundError",
    "RecipientPermissionDeniedError",
    "RecipientServiceError",
    "SkippedDelivery",
]
