import { LitElement, css, html, nothing } from "lit";

import type { NotificationManagerApi } from "../api";
import { normaliseApiError } from "../api";
import "../components/nm-button";
import "../components/nm-empty-state";
import type {
  CapabilityTarget,
  CurrentUser,
  NotificationRule,
  RecipientGroup,
  RecipientProfile,
} from "../models";
import { newRuleId, reviewSentence, semanticFromTrigger } from "../rule-draft";
import { pageStyles } from "./page-styles";

type RuleFilter = "ALL" | "MINE" | "HOUSEHOLD" | "ATTENTION";

export class NotificationsPage extends LitElement {
  static properties = {
    api: { attribute: false },
    currentUser: { attribute: false },
    rules: { attribute: false },
    targets: { attribute: false },
    recipients: { attribute: false },
    groups: { attribute: false },
    _error: { state: true },
    _filter: { state: true },
    _workingId: { state: true },
  };

  static styles = [
    pageStyles,
    css`
      .page-heading-row,
      .filters,
      .rule-row,
      .rule-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .page-heading-row {
        justify-content: space-between;
        margin-bottom: 20px;
      }

      .page-heading { margin: 0; }

      .filters {
        overflow-x: auto;
        gap: 2px;
        margin-bottom: 4px;
        border-bottom: 1px solid var(--nm-border);
      }

      .filter {
        min-block-size: 44px;
        border: 0;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        padding: 0 12px;
        background: transparent;
        color: var(--secondary-text-color, #616161);
        font: inherit;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
      }

      .filter[aria-pressed="true"] {
        border-bottom-color: var(--primary-color, #3f6f58);
        color: var(--primary-text-color, #212121);
      }

      .filter:hover { background: var(--secondary-background-color, #f1f1f1); }

      .filter:focus-visible,
      .rule-main:focus-visible,
      summary:focus-visible,
      .menu button:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .rule-list {
        border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      }

      .rule-row {
        justify-content: space-between;
        min-block-size: 76px;
        border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      }

      .rule-main {
        min-inline-size: 0;
        flex: 1;
        display: block;
        border: 0;
        padding: 12px 8px 12px 0;
        background: transparent;
        color: inherit;
        text-align: start;
        cursor: pointer;
      }

      .rule-name,
      .rule-summary { display: block; }

      .rule-name {
        font-size: 15px;
        font-weight: 600;
      }

      .rule-summary {
        overflow: hidden;
        margin-top: 3px;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rule-actions { flex: none; }

      .state {
        color: var(--secondary-text-color, #616161);
        font-size: 12px;
        font-weight: 700;
      }

      .state[data-state="NEEDS_ATTENTION"] { color: var(--error-color, #c62828); }

      details { position: relative; }

      summary {
        display: grid;
        place-items: center;
        inline-size: 44px;
        block-size: 44px;
        border-radius: 8px;
        cursor: pointer;
        list-style: none;
      }

      summary::-webkit-details-marker { display: none; }

      .menu {
        position: absolute;
        z-index: 3;
        inset-inline-end: 0;
        min-inline-size: 160px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
        border-radius: 8px;
        padding: 4px;
        background: var(--card-background-color, #fafafa);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
      }

      .menu button {
        inline-size: 100%;
        min-block-size: 40px;
        border: 0;
        border-radius: 5px;
        padding-inline: 10px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .menu button:hover { background: var(--secondary-background-color, #f1f1f1); }
      .menu .delete, .error { color: var(--error-color, #c62828); }
      .error { margin-block: 12px; }

      @media (max-width: 600px) {
        .page-heading-row { align-items: stretch; flex-direction: column; }
        .rule-summary { white-space: normal; }
        .state { display: none; }
      }
    `,
  ];

  api: NotificationManagerApi | undefined;
  currentUser: CurrentUser | undefined;
  rules: NotificationRule[] = [];
  targets: CapabilityTarget[] = [];
  recipients: RecipientProfile[] = [];
  groups: RecipientGroup[] = [];
  private _filter: RuleFilter = "ALL";
  private _workingId = "";
  private _error = "";

  private _filteredRules(): NotificationRule[] {
    return this.rules.filter((rule) => {
      if (this._filter === "MINE") return rule.owner_user_id === this.currentUser?.id;
      if (this._filter === "HOUSEHOLD") return rule.scope === "HOUSEHOLD";
      if (this._filter === "ATTENTION") return rule.health.status === "NEEDS_ATTENTION";
      return true;
    });
  }

  private _audienceLabel(rule: NotificationRule): string {
    return rule.audiences
      .map((audience) => {
        if (audience.type === "ME") return "me";
        if (audience.type === "EVERYONE") return "Everyone";
        if (audience.type === "ADMINS") return "Admins";
        if (audience.type === "RECIPIENT") {
          return this.recipients.find((item) => item.id === audience.recipient_id)?.display_name;
        }
        return this.groups.find((item) => item.id === audience.group_id)?.name;
      })
      .filter(Boolean)
      .join(", ");
  }

  private _summary(rule: NotificationRule): string {
    const target = this.targets.find((item) => item.entity_id === rule.trigger.target?.entity_id);
    const semantic = semanticFromTrigger(rule.trigger, target);
    if (!semantic || !rule.trigger.target) return `Notify ${this._audienceLabel(rule)}.`;
    const duration = rule.trigger.parameters.duration_seconds;
    const minutes = typeof duration === "number" ? Math.max(1, Math.round(duration / 60)) : 0;
    return reviewSentence(
      rule.trigger.target.display_name_snapshot,
      semantic,
      minutes,
      this._audienceLabel(rule),
    );
  }

  private _changed(): void {
    this.dispatchEvent(new CustomEvent("data-changed", { bubbles: true, composed: true }));
  }

  private async _toggle(rule: NotificationRule): Promise<void> {
    if (!this.api || this._workingId) return;
    this._workingId = rule.id;
    try {
      await this.api.setRuleEnabled(rule.id, !rule.enabled, rule.revision);
      this._changed();
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._workingId = "";
    }
  }

  private async _duplicate(rule: NotificationRule): Promise<void> {
    if (!this.api || this._workingId) return;
    this._workingId = rule.id;
    const now = new Date().toISOString();
    try {
      await this.api.createRule({
        ...rule,
        id: newRuleId(),
        revision: 0,
        name: `${rule.name} copy`,
        created_at: now,
        updated_at: now,
        health: { status: "HEALTHY", issues: [] },
      });
      this._changed();
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._workingId = "";
    }
  }

  private async _delete(rule: NotificationRule): Promise<void> {
    if (!this.api || this._workingId) return;
    if (!globalThis.confirm?.(`Delete “${rule.name}”? This cannot be undone.`)) return;
    this._workingId = rule.id;
    try {
      await this.api.deleteRule(rule.id, rule.revision);
      this._changed();
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._workingId = "";
    }
  }

  render() {
    const rules = this._filteredRules();
    return html`
      <div class="page-heading-row">
        <div class="page-heading">
          <h2>Notifications</h2>
          <p>See what your household will be told and whether anything needs attention.</p>
        </div>
        <notification-manager-button
          variant="primary"
          icon="mdi:plus"
          @click=${() =>
            this.dispatchEvent(new CustomEvent("rule-create", { bubbles: true, composed: true }))}
        >
          Create notification
        </notification-manager-button>
      </div>

      <div class="filters" role="group" aria-label="Filter notifications">
        ${([
          ["ALL", "All"],
          ["MINE", "Mine"],
          ["HOUSEHOLD", "Household"],
          ["ATTENTION", "Needs attention"],
        ] as const).map(
          ([value, label]) => html`
            <button
              class="filter"
              type="button"
              aria-pressed=${this._filter === value}
              @click=${() => (this._filter = value)}
            >
              ${label}
            </button>
          `,
        )}
      </div>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}

      ${rules.length === 0
        ? html`
            <notification-manager-empty-state
              icon="mdi:bell-outline"
              heading=${this.rules.length
                ? "No notifications match this filter"
                : "No notifications yet"}
              message=${this.rules.length
                ? "Choose another filter to see your notifications."
                : "Create one to tell someone when something important happens at home."}
            ></notification-manager-empty-state>
          `
        : html`
            <div class="rule-list" aria-label="Notification rules">
              ${rules.map(
                (rule) => html`
                  <article class="rule-row">
                    <button
                      class="rule-main"
                      type="button"
                      @click=${() =>
                        this.dispatchEvent(
                          new CustomEvent("rule-open", {
                            detail: { ruleId: rule.id },
                            bubbles: true,
                            composed: true,
                          }),
                        )}
                    >
                      <span class="rule-name">${rule.name}</span>
                      <span class="rule-summary">${this._summary(rule)}</span>
                    </button>
                    <div class="rule-actions">
                      <span class="state" data-state=${rule.health.status}>
                        ${rule.health.status === "NEEDS_ATTENTION"
                          ? "Needs attention"
                          : rule.enabled
                            ? "On"
                            : "Paused"}
                      </span>
                      <details>
                        <summary aria-label=${`More actions for ${rule.name}`}>
                          <ha-icon icon="mdi:dots-vertical" aria-hidden="true"></ha-icon>
                        </summary>
                        <div class="menu">
                          <button type="button" @click=${() => void this._toggle(rule)}>
                            ${rule.enabled ? "Pause" : "Resume"}
                          </button>
                          <button type="button" @click=${() => void this._duplicate(rule)}>
                            Duplicate
                          </button>
                          <button
                            class="delete"
                            type="button"
                            @click=${() => void this._delete(rule)}
                          >
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  </article>
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
