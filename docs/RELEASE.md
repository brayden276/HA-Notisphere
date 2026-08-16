# Release readiness

This checklist prevents a source-complete workspace from being mistaken for a tested Home Assistant release.

## Metadata blockers

The following facts are not present in this workspace and must be supplied by the repository owner:

- public GitHub owner and repository URL;
- documentation URL;
- issue tracker and private security-reporting route;
- one or more GitHub code owners;
- licence choice and copyright holder;
- Home Assistant Brands entry or an explicit decision about pre-publication custom-repository use;
- minimum supported Home Assistant release.

After those facts are known:

1. Add `documentation`, `issue_tracker` and `codeowners` to `custom_components/notification_manager/manifest.json`.
2. Add the chosen `LICENSE` file and update the README support section.
3. Configure the GitHub repository description, topics and issues.
4. Add the integration to Home Assistant Brands.
5. Add HACS and Hassfest validation workflows, and fix every result rather than ignoring checks.
6. Publish a semantic version release with matching versions in the integration manifest and Python project metadata.

## Package inspection

- [ ] `hacs.json` is valid JSON and contains the product name.
- [ ] Exactly one directory exists below `custom_components`.
- [ ] Every runtime file is inside `custom_components/notification_manager`.
- [ ] `manifest.json` has a valid semantic version and its domain matches the directory.
- [ ] `frontend/notification-manager-panel.js` is present inside the component.
- [ ] The packaged panel and Python code come from the same release.
- [ ] No absolute development paths, credentials, tokens, household names, entity IDs or notification targets are packaged.
- [ ] A clean checkout passes Python tests, linting and type checks.
- [ ] Frontend tests and its production packaging check pass under the release workflow.

## Upgrade inspection

- [ ] Upgrade from the previous public release preserves rules, recipients, groups and activity.
- [ ] Every storage-schema increment has a tested, sequential migration.
- [ ] A future or malformed storage schema fails clearly without overwriting the stored value.
- [ ] The README describes any irreversible storage change and rollback requirement.
- [ ] The sidebar loads the new panel after restart and browser refresh.

## Home Assistant acceptance

Use a disposable Home Assistant instance with at least one Companion App notification target and test entity.

- [ ] Copy or install the component and restart Home Assistant.
- [ ] Add Notification Manager through the config flow without a startup traceback.
- [ ] Confirm the **Notifications** sidebar panel loads and its WebSocket session connects.
- [ ] Confirm at least one recipient mapping and send a test notification.
- [ ] Create an immediate binary-state rule, change the entity and observe delivery plus activity.
- [ ] Create a 30-second duration rule; verify resolving early cancels it and remaining active sends once.
- [ ] Resolve **Everyone**, **Admins** and an overlapping custom group without duplicate endpoint delivery.
- [ ] Make a target unavailable or remove it and confirm a human-readable health state without an uncontrolled exception.
- [ ] Reload the config entry and restart Home Assistant; confirm persistence, watcher reconstruction and panel reconnect.
- [ ] Inspect Home Assistant logs and browser console for product-caused unhandled errors.

Record the Home Assistant version, Companion App platform, exact scenarios and observed outcomes in the release notes. Configuration parsing, unit tests or a packaged JavaScript file are not substitutes for this acceptance run.

