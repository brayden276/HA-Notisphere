import { LitElement, html } from "lit";

import "../components/nm-empty-state";
import type { ActivityRecord } from "../models";
import { pageStyles } from "./page-styles";

const STATUS_LABELS = {
  SENT: "Sent",
  PARTIAL: "Partially sent",
  SKIPPED: "Skipped",
  FAILED: "Failed",
  TEST: "Test",
} as const;

export class ActivityPage extends LitElement {
  static properties = {
    activity: { attribute: false },
  };

  static styles = [pageStyles];

  activity: ActivityRecord[] = [];

  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.valueOf())) {
      return timestamp;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  render() {
    const records = [...this.activity].sort(
      (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
    );
    return html`
      <div class="page-heading">
        <h2>Activity</h2>
        <p>Recent delivery results for notifications you can access.</p>
      </div>
      ${records.length === 0
        ? html`
            <notification-manager-empty-state
              icon="mdi:history"
              heading="No activity yet"
              message="Delivery results will appear after a notification is evaluated."
            ></notification-manager-empty-state>
          `
        : html`
            <div class="data-list" aria-label="Notification activity">
              ${records.map(
                (record) => html`
                  <div class="data-row">
                    <div>
                      <span class="row-primary">${record.trigger_summary}</span>
                      <span class="row-secondary">
                        ${this.formatTimestamp(record.timestamp)}
                        ${record.reason ? html`<br />${record.reason}` : null}
                      </span>
                    </div>
                    <div class="row-meta">
                      <span class="status" data-status=${record.status}>
                        ${STATUS_LABELS[record.status]}
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

if (!customElements.get("notification-manager-activity-page")) {
  customElements.define("notification-manager-activity-page", ActivityPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-activity-page": ActivityPage;
  }
}
