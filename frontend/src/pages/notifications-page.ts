import { LitElement, html } from "lit";

import "../components/nm-empty-state";
import type { NotificationRule } from "../models";
import { pageStyles } from "./page-styles";

const HEALTH_LABELS = {
  HEALTHY: "Healthy",
  DEGRADED: "Degraded",
  NEEDS_ATTENTION: "Needs attention",
} as const;

export class NotificationsPage extends LitElement {
  static properties = {
    rules: { attribute: false },
  };

  static styles = [pageStyles];

  rules: NotificationRule[] = [];

  render() {
    return html`
      <div class="page-heading">
        <h2>Notifications</h2>
        <p>Review the notification rules available to your Home Assistant account.</p>
      </div>
      ${this.rules.length === 0
        ? html`
            <notification-manager-empty-state
              icon="mdi:bell-outline"
              heading="No notifications yet"
              message="Notification rules will appear here after they are created."
            ></notification-manager-empty-state>
          `
        : html`
            <div class="data-list" aria-label="Notification rules">
              ${this.rules.map(
                (rule) => html`
                  <div class="data-row">
                    <div>
                      <span class="row-primary">${rule.name}</span>
                      <span class="row-secondary">
                        ${rule.scope === "HOUSEHOLD" ? "Household" : "Personal"}
                        notification, ${rule.enabled ? "enabled" : "disabled"}
                      </span>
                    </div>
                    <div class="row-meta">
                      <span class="status" data-status=${rule.health.status}>
                        ${HEALTH_LABELS[rule.health.status]}
                      </span>
                    </div>
                  </div>
                `,
              )}
            </div>
          `}
    `;
  }
}

if (!customElements.get("notification-manager-notifications-page")) {
  customElements.define("notification-manager-notifications-page", NotificationsPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-notifications-page": NotificationsPage;
  }
}
