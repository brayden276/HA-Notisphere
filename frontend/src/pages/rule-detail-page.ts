import { LitElement, css, html, nothing } from "lit";

import type { NotificationManagerApi } from "../api";
import { normaliseApiError } from "../api";
import { activityOutcome } from "../activity-format";
import "../components/nm-button";
import "../components/nm-status-panel";
import type {
  ActivityRecord,
  Audience,
  CapabilityTarget,
  NotificationRule,
  RecipientGroup,
  RecipientProfile,
} from "../models";
import { reviewSentence, semanticFromTrigger } from "../rule-draft";
import { pageStyles } from "./page-styles";

export class RuleDetailPage extends LitElement {
  static properties = {
    api: { attribute: false },
    rule: { attribute: false },
    activity: { attribute: false },
    targets: { attribute: false },
    recipients: { attribute: false },
    groups: { attribute: false },
    _busy: { state: true },
    _feedback: { state: true },
  };

  static styles = [
    pageStyles,
    css`
      :host {
        max-inline-size: 840px;
        margin-inline: auto;
      }

      .back-row { margin-bottom: var(--nm-space-3); }

      .title-row,
      .actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--nm-space-3);
      }

      .title-row h2 {
        flex: 1;
      }

      .summary {
        max-inline-size: 65ch;
        margin: var(--nm-space-3) 0 var(--nm-space-5);
        color: var(--primary-text-color, #212121);
        font-size: 17px;
        line-height: 1.55;
      }

      .actions {
        justify-content: flex-start;
        flex-wrap: wrap;
        margin-bottom: var(--nm-space-5);
      }

      .section {
        padding-top: var(--nm-space-4);
        border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      }

      .feedback {
        margin-block: 12px;
        color: var(--secondary-text-color, #616161);
      }

      .danger {
        margin-top: var(--nm-space-5);
      }

      @media (max-width: 600px) {
        .title-row {
          align-items: flex-start;
        }

        .actions notification-manager-button {
          flex: 1;
        }
      }
    `,
  ];

  api: NotificationManagerApi | undefined;
  rule: NotificationRule | undefined;
  activity: ActivityRecord[] = [];
  targets: CapabilityTarget[] = [];
  recipients: RecipientProfile[] = [];
  groups: RecipientGroup[] = [];
  private _busy = false;
  private _feedback = "";

  private _audienceLabel(audiences: Audience[]): string {
    const names = audiences.map((audience) => {
      if (audience.type === "ME") return "me";
      if (audience.type === "EVERYONE") return "Everyone";
      if (audience.type === "ADMINS") return "Admins";
      if (audience.type === "RECIPIENT") {
        return (
          this.recipients.find((recipient) => recipient.id === audience.recipient_id)
            ?.display_name ?? "a household member"
        );
      }
      return this.groups.find((group) => group.id === audience.group_id)?.name ?? "a group";
    });
    return names.join(", ");
  }

  private _resolvedRecipients(rule: NotificationRule): RecipientProfile[] {
    const ids = new Set<string>();
    for (const audience of rule.audiences) {
      if (audience.type === "ME") {
        const owner = this.recipients.find(
          (recipient) => recipient.ha_user_id === rule.owner_user_id,
        );
        if (owner) ids.add(owner.id);
      } else if (audience.type === "EVERYONE") {
        this.recipients.forEach((recipient) => ids.add(recipient.id));
      } else if (audience.type === "RECIPIENT" && audience.recipient_id) {
        ids.add(audience.recipient_id);
      } else if (audience.type === "GROUP" && audience.group_id) {
        this.groups
          .find((group) => group.id === audience.group_id)
          ?.member_recipient_ids.forEach((recipientId) => ids.add(recipientId));
      }
    }
    return this.recipients.filter((recipient) => ids.has(recipient.id));
  }

  private _summary(): string {
    if (!this.rule?.trigger.target) return "This notification needs a replacement device.";
    const target = this.targets.find(
      (item) => item.entity_id === this.rule?.trigger.target?.entity_id,
    );
    const semantic = semanticFromTrigger(this.rule.trigger, target);
    if (!semantic) return `Notify ${this._audienceLabel(this.rule.audiences)} when the event occurs.`;
    const duration = this.rule.trigger.parameters.duration_seconds;
    const minutes = typeof duration === "number" ? Math.max(1, Math.round(duration / 60)) : 0;
    return reviewSentence(
      this.rule.trigger.target.display_name_snapshot,
      semantic,
      minutes,
      this._audienceLabel(this.rule.audiences),
    );
  }

  private _conditionSummary(rule: NotificationRule): string {
    if (rule.conditions.length === 0) return "No additional conditions";
    return rule.conditions
      .map((condition) => {
        if (condition.type === "TIME_WINDOW") {
          return `between ${String(condition.parameters.start)} and ${String(condition.parameters.end)}`;
        }
        const name = condition.target?.display_name_snapshot ?? "the selected device";
        if (condition.type === "PERSON_HOME") return `${name} is home`;
        if (condition.type === "PERSON_AWAY") return `${name} is away`;
        const target = this.targets.find(
          (candidate) => candidate.entity_id === condition.target?.entity_id,
        );
        const expected = condition.parameters.state;
        if (target?.category === "motion") {
          return `${name} is ${expected === "on" ? "detecting activity" : "clear"}`;
        }
        return `${name} is ${expected === "on" ? "open or active" : "closed or inactive"}`;
      })
      .join(" and ");
  }

  private async _test(): Promise<void> {
    if (!this.api || !this.rule || this._busy) return;
    this._busy = true;
    try {
      const record = await this.api.testRule(this.rule.id);
      const sent = record.recipient_results.filter((item) => item.status === "SENT").length;
      this._feedback = sent
        ? `Test sent to ${sent} ${sent === 1 ? "person" : "people"}.`
        : record.reason ?? "No eligible phone could receive the test.";
      this.dispatchEvent(new CustomEvent("data-changed", { bubbles: true, composed: true }));
    } catch (error) {
      this._feedback = normaliseApiError(error).message;
    } finally {
      this._busy = false;
    }
  }

  private async _toggle(): Promise<void> {
    if (!this.api || !this.rule || this._busy) return;
    this._busy = true;
    try {
      await this.api.setRuleEnabled(this.rule.id, !this.rule.enabled, this.rule.revision);
      this.dispatchEvent(new CustomEvent("data-changed", { bubbles: true, composed: true }));
    } catch (error) {
      this._feedback = normaliseApiError(error).message;
    } finally {
      this._busy = false;
    }
  }

  private async _delete(): Promise<void> {
    if (!this.api || !this.rule || this._busy) return;
    if (!globalThis.confirm?.(`Delete “${this.rule.name}”? This cannot be undone.`)) return;
    this._busy = true;
    try {
      await this.api.deleteRule(this.rule.id, this.rule.revision);
      this.dispatchEvent(new CustomEvent("rule-deleted", { bubbles: true, composed: true }));
    } catch (error) {
      this._feedback = normaliseApiError(error).message;
      this._busy = false;
    }
  }

  render() {
    const rule = this.rule;
    if (!rule) {
      return html`
        <notification-manager-status-panel
          kind="error"
          heading="Notification not found"
          message="It may have been deleted in another browser."
        ></notification-manager-status-panel>
      `;
    }
    const recent = this.activity.filter((item) => item.rule_id === rule.id).slice(0, 5);
    const last = recent[0];
    const resolvedRecipients = this._resolvedRecipients(rule);
    const phoneCount = resolvedRecipients.filter((recipient) =>
      recipient.endpoints.some((endpoint) => endpoint.enabled),
    ).length;
    return html`
      <div class="back-row">
        <notification-manager-button
          variant="quiet"
          icon="mdi:arrow-left"
          @click=${() =>
            this.dispatchEvent(new CustomEvent("detail-close", { bubbles: true, composed: true }))}
        >
          Notifications
        </notification-manager-button>
      </div>
      <div class="title-row">
        <h2>${rule.name}</h2>
        <span class="status" data-status=${rule.health.status}>
          ${rule.health.status === "NEEDS_ATTENTION"
            ? "Needs attention"
            : rule.enabled
              ? "On"
              : "Paused"}
        </span>
      </div>
      <p class="summary">${this._summary()}</p>

      ${rule.health.issues.length
        ? html`
            <notification-manager-status-panel
              kind=${rule.health.status === "NEEDS_ATTENTION" ? "error" : "info"}
              heading=${rule.health.status === "NEEDS_ATTENTION" ? "Needs attention" : "Limited"}
              .message=${rule.health.issues.map((issue) => issue.message).join(" ")}
            ></notification-manager-status-panel>
          `
        : nothing}

      <div class="actions">
        <notification-manager-button
          variant="primary"
          icon="mdi:pencil-outline"
          @click=${() =>
            this.dispatchEvent(new CustomEvent("rule-edit", { bubbles: true, composed: true }))}
        >
          ${rule.health.status === "NEEDS_ATTENTION" ? "Choose replacement" : "Edit"}
        </notification-manager-button>
        <notification-manager-button .disabled=${this._busy} @click=${this._test}>
          Send test
        </notification-manager-button>
        <notification-manager-button .disabled=${this._busy} @click=${this._toggle}>
          ${rule.enabled ? "Pause" : "Resume"}
        </notification-manager-button>
      </div>
      ${this._feedback ? html`<p class="feedback" aria-live="polite">${this._feedback}</p>` : nothing}

      <section class="section" aria-labelledby="details-heading">
        <h3 id="details-heading">Details</h3>
        <dl class="definition-list">
          <dt>Recipients</dt>
          <dd>
            ${this._audienceLabel(rule.audiences)}
            ${resolvedRecipients.length
              ? html`<br />${resolvedRecipients.length}
                  ${resolvedRecipients.length === 1 ? "person" : "people"}, ${phoneCount}
                  ${phoneCount === 1 ? "phone" : "phones"}`
              : nothing}
          </dd>
          <dt>Conditions</dt>
          <dd>${this._conditionSummary(rule)}</dd>
          <dt>Last triggered</dt>
          <dd>${last ? new Date(last.timestamp).toLocaleString() : "Not yet"}</dd>
          <dt>Last result</dt>
          <dd>${last ? activityOutcome(last) : "No activity yet"}</dd>
        </dl>
      </section>

      <section class="section" aria-labelledby="recent-heading">
        <h3 id="recent-heading">Recent activity</h3>
        ${recent.length
          ? html`
              <div class="data-list">
                ${recent.map(
                  (record) => html`
                    <div class="data-row">
                      <div>
                        <span class="row-primary">${record.trigger_summary}</span>
                        <span class="row-secondary">
                          ${new Date(record.timestamp).toLocaleString()}<br />${activityOutcome(record)}
                        </span>
                      </div>
                      <span class="status" data-status=${record.status}>${record.status.toLowerCase()}</span>
                    </div>
                  `,
                )}
              </div>
            `
          : html`<p class="hint">No activity has been recorded for this notification.</p>`}
      </section>

      <div class="danger">
        <notification-manager-button
          variant="danger"
          .disabled=${this._busy}
          @click=${this._delete}
        >
          Delete notification
        </notification-manager-button>
      </div>
    `;
  }
}

if (!customElements.get("notification-manager-rule-detail-page")) {
  customElements.define("notification-manager-rule-detail-page", RuleDetailPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-rule-detail-page": RuleDetailPage;
  }
}
