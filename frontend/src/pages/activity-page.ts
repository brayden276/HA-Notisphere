import { LitElement, css, html, nothing } from "lit";

import type { NotificationManagerApi } from "../api";
import { normaliseApiError } from "../api";
import { activityOutcome, recipientOutcome } from "../activity-format";
import "../components/nm-button";
import "../components/nm-empty-state";
import type {
  ActivityRecord,
  ActivityStatus,
  NotificationRule,
  RecipientProfile,
} from "../models";
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
    api: { attribute: false },
    activity: { attribute: false },
    rules: { attribute: false },
    recipients: { attribute: false },
    _error: { state: true },
    _records: { state: true },
    _refreshing: { state: true },
    _recipientId: { state: true },
    _ruleId: { state: true },
    _status: { state: true },
  };

  static styles = [
    pageStyles,
    css`
      .filters {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
        align-items: end;
        gap: var(--nm-space-3);
        margin-bottom: var(--nm-space-4);
      }

      label { display: grid; gap: var(--nm-space-2); font-weight: 600; }

      .error { margin-bottom: 12px; color: var(--error-color, #c62828); }

      .delivery-results {
        display: grid;
        gap: 2px;
        margin: 6px 0 0;
        padding: 0;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
        list-style: none;
      }

      @media (max-width: 760px) {
        .filters { grid-template-columns: 1fr; }
      }
    `,
  ];

  api: NotificationManagerApi | undefined;
  activity: ActivityRecord[] = [];
  rules: NotificationRule[] = [];
  recipients: RecipientProfile[] = [];
  private _records: ActivityRecord[] | undefined;
  private _ruleId = "";
  private _recipientId = "";
  private _status: ActivityStatus | "" = "";
  private _refreshing = false;
  private _error = "";

  private async _refresh(): Promise<void> {
    if (!this.api || this._refreshing) return;
    this._refreshing = true;
    this._error = "";
    try {
      this._records = await this.api.listActivity({
        ruleId: this._ruleId || undefined,
        recipientId: this._recipientId || undefined,
        status: this._status || undefined,
      });
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._refreshing = false;
    }
  }

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
    const records = [...(this._records ?? this.activity)].sort(
      (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
    );
    return html`
      <div class="page-heading">
        <h2>Activity</h2>
        <p>Review what was sent, skipped or unable to reach a phone.</p>
      </div>
      <div class="filters" aria-label="Activity filters">
        <label>
          Notification
          <select
            .value=${this._ruleId}
            @change=${(event: Event) => {
              this._ruleId = (event.currentTarget as HTMLSelectElement).value;
              void this._refresh();
            }}
          >
            <option value="">All notifications</option>
            ${this.rules.map((rule) => html`<option value=${rule.id}>${rule.name}</option>`)}
          </select>
        </label>
        <label>
          Person
          <select
            .value=${this._recipientId}
            @change=${(event: Event) => {
              this._recipientId = (event.currentTarget as HTMLSelectElement).value;
              void this._refresh();
            }}
          >
            <option value="">Everyone</option>
            ${this.recipients.map(
              (recipient) => html`<option value=${recipient.id}>${recipient.display_name}</option>`,
            )}
          </select>
        </label>
        <label>
          Result
          <select
            .value=${this._status}
            @change=${(event: Event) => {
              this._status = (event.currentTarget as HTMLSelectElement).value as ActivityStatus | "";
              void this._refresh();
            }}
          >
            <option value="">All results</option>
            ${Object.entries(STATUS_LABELS).map(
              ([status, label]) => html`<option value=${status}>${label}</option>`,
            )}
          </select>
        </label>
        <notification-manager-button
          icon="mdi:refresh"
          .disabled=${this._refreshing}
          @click=${this._refresh}
        >
          Reload
        </notification-manager-button>
      </div>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}
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
                        <br />${activityOutcome(record)}
                      </span>
                      ${record.recipient_results.length > 1 || record.status === "PARTIAL"
                        ? html`
                            <ul class="delivery-results" aria-label="Recipient results">
                              ${record.recipient_results.map(
                                (result) => html`<li>${recipientOutcome(result)}</li>`,
                              )}
                            </ul>
                          `
                        : nothing}
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
