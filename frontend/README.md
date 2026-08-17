# Notification Manager frontend

This directory contains the TypeScript and Lit source for the Home Assistant custom panel.

## Commands

- `npm test` runs the Vitest unit tests without producing the panel bundle.
- `npm run typecheck` checks the TypeScript source without producing output.
- `npm run build` writes `notification-manager-panel.js` to `custom_components/notification_manager/frontend/`.

The integration serves the generated JavaScript file directly. Do not edit the generated bundle by hand.

Pushes to `main` that change this directory trigger `.github/workflows/build-panel.yml`. It runs the frontend checks, rebuilds the packaged panel and commits the generated JavaScript when it changed. The workflow's `contents: write` permission must remain enabled for that commit step.
