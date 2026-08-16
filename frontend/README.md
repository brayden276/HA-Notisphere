# Notification Manager frontend

This directory contains the TypeScript and Lit source for the Home Assistant custom panel.

## Commands

- `npm test` runs the Vitest unit tests without producing the panel bundle.
- `npm run typecheck` checks the TypeScript source without producing output.
- `npm run build` writes `notification-manager-panel.js` and its source map to `custom_components/notification_manager/frontend/`.

The integration serves the generated JavaScript file directly. Do not edit the generated bundle by hand.
