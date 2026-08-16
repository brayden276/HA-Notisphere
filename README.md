# Notification Manager for Home Assistant

Notification Manager is a custom Home Assistant integration and sidebar panel for creating household phone notifications in plain language:

> Tell everyone when the garage door has been open for five minutes.

It keeps notification rules, household recipients, groups, activity and health in Home Assistant. Users do not need to write YAML, templates or `notify.mobile_app_*` service calls.

> [!IMPORTANT]
> This repository is pre-release software. Automated component tests exist, but a clean installation and end-to-end run in a real Home Assistant instance must be completed before a production release is published.

## What it provides

- Personal and household notification rules with permission checks.
- Human-friendly discovery for binary sensors, people, numeric sensors and time targets.
- Home Assistant user, `person` and Companion App notification-device discovery.
- `Me`, `Everyone`, `Admins`, individual recipient and custom-group audiences.
- Endpoint selection and de-duplication when audiences overlap.
- Immediate binary-state and state-duration runtime triggers.
- Person home/away, time-window and entity-state conditions with AND semantics.
- Test notifications and capability-aware mobile payloads.
- Sent, partial, skipped, failed and test activity records.
- Activity retention capped at 30 days or 1,000 records, whichever is reached first.
- Revision checks that prevent one browser session silently overwriting a newer edit.
- Versioned local persistence and strict storage validation.

Numeric-threshold, presence and time trigger types are represented in the versioned rule contract, but should not be treated as production runtime features until their execution paths have passed Home Assistant acceptance testing.

## Requirements

- Home Assistant with support for config flows and custom panels.
- At least one Home Assistant Companion App registration if phone delivery is required.
- An administrator for initial installation and household/group configuration.
- The packaged panel file at `custom_components/notification_manager/frontend/notification-manager-panel.js`.

The minimum supported Home Assistant release has not yet been established. Pin one before the first public release and test both that version and the current stable release.

## Direct installation

Use this route for local testing while the project has no published HACS repository.

1. Download or clone this repository to another computer or Home Assistant add-on workspace.
2. Confirm that `custom_components/notification_manager/frontend/notification-manager-panel.js` is present. A source checkout without this packaged file will not load the sidebar panel.
3. Copy the complete `custom_components/notification_manager` directory to `<Home Assistant config>/custom_components/notification_manager`.
4. Restart Home Assistant.
5. In Home Assistant, open **Settings → Devices & services → Add integration**.
6. Search for **Notification Manager** and select it. There are no accounts, keys or settings to enter; Home Assistant creates the integration immediately.
7. Open **Notifications** in the sidebar.

For Home Assistant OS, `/config` is normally the configuration directory, so the installed component path is:

```text
/config/custom_components/notification_manager
```

Do not copy the repository root into `custom_components`; Home Assistant expects the domain directory itself at the path above.

## HACS installation

A minimal `hacs.json` is included, and the code is laid out as one integration under `custom_components`. HACS publication is not yet available because this workspace does not define a public GitHub repository, documentation URL, issue tracker, code owner or brand entry.

After those release details are supplied and validation passes, users will be able to add the public GitHub URL as a HACS custom repository of type **Integration**, download **Notification Manager**, restart Home Assistant and select it from **Settings → Devices & services → Add integration**. Setup then completes immediately without YAML, credentials or advanced options.

See [Release readiness](docs/RELEASE.md) for the remaining publication checklist.

## First setup and test

1. Open **Notifications**. On a new installation, an administrator is taken to the short household setup screen automatically.
2. Review the discovered household members and phones. Companion App registrations with an explicit Home Assistant owner are assigned automatically; only genuinely ambiguous matches require confirmation.
3. Optionally send a test notification, then select **Create first notification**.
4. Choose a door or window, select **Stays open**, enter a short test duration, and choose **Me** or **Everyone**.
5. Review the generated message and save the notification.
6. Change the selected entity to its active state. Resolve it before the duration expires to confirm that no notification is sent, then repeat and leave it active through the duration.
7. Open **Activity** to review the delivery result.

Discovery deliberately avoids guessing when multiple users or devices look alike. An administrator should resolve those mappings in the panel rather than entering notification service names into normal rule screens.

## Configuration behaviour

Notification Manager is added once; it does not use YAML configuration.

- Active Home Assistant users become recipient candidates.
- A `person` directly linked to a Home Assistant user is associated automatically when the relationship is unique.
- Companion App notification services are associated from their Home Assistant registration owner when available, then from an existing confirmed mapping or a unique normalised name match.
- New, removed or renamed Companion App notification services and relevant `person` changes refresh recipient discovery automatically; no integration reload is normally required.
- **Everyone** and **Admins** are system groups resolved from the current household directory at delivery time.
- Administrators manage custom groups and household notifications.
- A non-administrator may manage their own recipient mapping and personal notifications, subject to their Home Assistant access.
- A rule selects the current primary eligible endpoint for each recipient and de-duplicates the same physical notification target across overlapping audiences.

Rules do not copy or generate Home Assistant automations. The integration watches the relevant Home Assistant state changes and owns its notification-specific timers.

## Resource use

Notification Manager is event-driven and does not poll Home Assistant. It subscribes only to entity IDs used by enabled rules, keeps at most one duration timer per active rule, and filters recipient and health events before scheduling work. Changes to rules update those indexes immediately.

Activity history is bounded to 1,000 records, dashboard bootstrap and activity requests default to 100 records, and bursts of activity writes are coalesced through Home Assistant's storage helper. Rules and household settings still use immediate durable writes. Recipient and group discovery also avoids storage writes when the discovered result has not changed.

## Data, privacy and security

Notification Manager has no separate server, cloud account, database or analytics service. Rules, recipient mappings, groups and bounded activity history are stored through Home Assistant's local storage system under the key `notification_manager.state`. Notification delivery uses Home Assistant's existing Companion App notification services.

Stored data can include:

- Home Assistant user IDs and display names;
- `person`, entity-registry and device references;
- phone notification service targets;
- notification titles and messages;
- per-recipient delivery outcomes and failure reasons;
- timestamps for activity and rule changes.

Treat Home Assistant backups as sensitive because they may contain this information. Restrict configuration-directory and backup access, use HTTPS for remote Home Assistant access, and keep Home Assistant and the Companion App updated. Image and deep-link values may direct a phone to another URL; only configure destinations trusted by the household.

The panel uses Home Assistant's authenticated WebSocket connection. Household rules and custom groups are administrator-controlled; personal rule access is limited to the owning user, while administrators retain oversight. Detailed entity and service identifiers belong in administrator diagnostics, not the normal workflow.

## Upgrading and storage migrations

1. Create a Home Assistant backup before upgrading a pre-release installation.
2. Replace the installed integration files as one matching release. Do not mix backend files and a panel bundle from different releases.
3. Restart Home Assistant and hard-refresh the browser if the panel still shows an older interface.
4. Confirm that recipient mappings, rules and activity load, then send a test notification.

Persistence is schema-versioned. Supported older schemas are migrated while loading; malformed data, an unsupported future schema, or a missing migration causes setup to fail instead of silently discarding household rules. Downgrading after a storage-schema change may therefore require restoring the pre-upgrade backup.

Release maintainers must keep the semantic version in `custom_components/notification_manager/manifest.json` and `pyproject.toml` aligned.

## Troubleshooting

### Notification Manager is missing from Add integration

- Confirm the installed path ends in `custom_components/notification_manager/manifest.json`.
- Restart Home Assistant after copying the integration; a browser refresh alone is not sufficient.
- Review **Settings → System → Logs** for `notification_manager` setup errors.
- Remove duplicate or nested copies such as `custom_components/notification_manager/notification_manager`.

### The Notifications sidebar item is missing or blank

- Confirm `custom_components/notification_manager/frontend/notification-manager-panel.js` exists in the installed copy.
- Restart Home Assistant, then hard-refresh the browser or clear the Home Assistant frontend cache.
- Check the browser developer console for a failed request to `/api/notification_manager/frontend/notification-manager-panel.js` and review Home Assistant logs for panel-registration errors.
- Confirm the Notification Manager config entry is loaded, not disabled or awaiting a retry.

### A household member has no phone

- Confirm that person has signed in to the Home Assistant Companion App and registered the device with this Home Assistant instance.
- Wait a moment after Companion App registration; Notification Manager refreshes automatically when Home Assistant publishes the phone's notification service.
- Review **People & Groups** for an unconfirmed or ambiguous match.
- Administrators can use Home Assistant developer tools to confirm the expected `notify.mobile_app_*` service exists, but normal users should not need to enter it manually.

### A rule does not send

- Confirm the rule is on and does not show **Needs attention**.
- Check **Activity** for a skipped, partial or failed explanation.
- Confirm the target and every condition target are currently available.
- For **Stays open/on**, remember that any resolving, `unknown` or `unavailable` state cancels the pending timer. After a Home Assistant restart, duration timing starts from the current state and is not backdated.
- Confirm at least one selected recipient has an enabled eligible endpoint.

### Delivery is partial or failed

- Send a test from the affected recipient profile.
- Check notification permissions, battery restrictions and connectivity on the phone.
- Confirm the Companion App device still belongs to the intended Home Assistant user.
- If a phone was replaced, confirm the new endpoint and make it primary; rules continue to target the person rather than the old phone.
- Rich payload fields are sent only when the selected endpoint advertises the required capability.

### A rule shows Needs attention

Notification Manager does not silently replace a deleted trigger entity. Select the rule, review the human-readable issue and choose a verified replacement. If the entity was only renamed through Home Assistant's entity registry, reload the integration after confirming the registry entry.

## Removal

1. In **Settings → Devices & services**, open Notification Manager and delete its config entry.
2. Remove `/config/custom_components/notification_manager`.
3. Restart Home Assistant.

The local storage record may remain so an accidental removal does not silently erase rules. To permanently erase it, first create a backup, stop Home Assistant, then remove the `notification_manager.state` entry from Home Assistant's `.storage` area using an appropriate Home Assistant maintenance workflow. Do not edit `.storage` while Home Assistant is running.

## Development checks

The repository's source checks are:

```text
python -m pytest -q -p no:cacheprovider
ruff check custom_components tests
mypy custom_components/notification_manager
cd frontend
npm run typecheck
npm test
```

The checked-in validation workflow runs these checks and validates the JSON descriptors. It intentionally does not run a frontend production build. Release validation must separately create and verify the packaged panel, then complete the real Home Assistant acceptance scenarios in [Release readiness](docs/RELEASE.md).

## Support and contributing

No public issue tracker or contribution URL has been assigned. Before publication, replace this section with the repository's real support and security-reporting links, add the owner to the integration manifest, and adopt an explicit licence. Until then, do not redistribute the project as an open-source release.
