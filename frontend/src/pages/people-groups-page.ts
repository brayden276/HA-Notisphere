import { LitElement, css, html, nothing } from "lit";

import type { NotificationManagerApi } from "../api";
import { normaliseApiError } from "../api";
import "../components/nm-button";
import "../components/nm-empty-state";
import "../components/nm-status-panel";
import type {
  CurrentUser,
  RecipientGroup,
  RecipientProfile,
  UnconfirmedRecipientMapping,
} from "../models";
import { newRuleId } from "../rule-draft";
import { pageStyles } from "./page-styles";

export class PeopleGroupsPage extends LitElement {
  static properties = {
    api: { attribute: false },
    currentUser: { attribute: false },
    recipients: { attribute: false },
    groups: { attribute: false },
    onboarding: { type: Boolean },
    unconfirmedMappings: { attribute: false },
    _busy: { state: true },
    _editingGroupId: { state: true },
    _error: { state: true },
    _feedback: { state: true },
    _groupMembers: { state: true },
    _groupName: { state: true },
    _mappingRecipientIds: { state: true },
    _openRecipientId: { state: true },
  };

  static styles = [
    pageStyles,
    css`
      .section-heading-row,
      .person-row,
      .group-row,
      .actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--nm-space-3);
      }

      .section-heading-row { margin-bottom: var(--nm-space-3); }
      .section-heading { margin: 0; }

      .person,
      .group {
        border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      }

      .person:first-child,
      .group:first-child { border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3)); }

      .person-row,
      .group-row { min-block-size: var(--nm-row-height-comfortable); }

      .person-main {
        min-inline-size: 0;
        flex: 1;
        border: 0;
        padding: 10px 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .person-main:focus-visible,
      input:focus-visible,
      button:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .person-name,
      .person-device { display: block; }
      .person-name { font-weight: 600; }
      .person-device { margin-top: 2px; color: var(--secondary-text-color, #616161); font-size: 13px; }

      .profile,
      .group-form {
        margin-bottom: 14px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        border-radius: var(--nm-radius);
        padding: var(--nm-space-4);
        background: var(--secondary-background-color, #f1f1f1);
      }

      .group-form > label { display: grid; gap: var(--nm-space-2); font-weight: 600; }

      .endpoint-list { display: grid; gap: var(--nm-space-2); margin-block: var(--nm-space-2); }

      .endpoint {
        display: flex;
        align-items: center;
        gap: var(--nm-space-2);
        min-block-size: var(--nm-control-height);
        font-weight: 500;
      }

      .endpoint input { inline-size: 18px; block-size: 18px; }

      .actions { justify-content: flex-start; flex-wrap: wrap; }

      .feedback { margin: 10px 0; color: var(--secondary-text-color, #616161); }
      .error { color: var(--error-color, #c62828); }

      .group-form {
        display: grid;
        gap: var(--nm-space-3);
        max-inline-size: 620px;
        margin-top: 12px;
      }

      .group-form input[type="text"] { inline-size: 100%; }

      .mapping-list { display: grid; gap: var(--nm-space-3); margin-top: var(--nm-space-3); }

      .mapping-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(180px, 0.7fr) auto;
        align-items: center;
        gap: var(--nm-space-3);
        border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-bottom: var(--nm-space-3);
      }

      .mapping-row select { inline-size: 100%; }

      .member-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--nm-space-2) var(--nm-space-4);
      }

      .member-grid label {
        display: flex;
        align-items: center;
        gap: 8px;
        min-block-size: var(--nm-control-height);
      }

      .group-actions { display: flex; align-items: center; gap: 4px; }

      @media (max-width: 600px) {
        .member-grid { grid-template-columns: 1fr; }
        .mapping-row { grid-template-columns: 1fr; }
        .group-row { align-items: flex-start; padding-block: 8px; }
      }
    `,
  ];

  api: NotificationManagerApi | undefined;
  currentUser: CurrentUser | undefined;
  recipients: RecipientProfile[] = [];
  groups: RecipientGroup[] = [];
  onboarding = false;
  unconfirmedMappings: UnconfirmedRecipientMapping[] = [];
  private _openRecipientId = "";
  private _busy = false;
  private _feedback = "";
  private _error = "";
  private _editingGroupId = "";
  private _groupName = "";
  private _groupMembers: string[] = [];
  private _mappingRecipientIds: Record<string, string> = {};

  private _activeEndpointCount(recipient: RecipientProfile): number {
    return recipient.endpoints.filter((endpoint) => endpoint.enabled).length;
  }

  private _canEdit(recipient: RecipientProfile): boolean {
    return Boolean(this.currentUser?.is_admin || recipient.ha_user_id === this.currentUser?.id);
  }

  private _changed(): void {
    this.dispatchEvent(new CustomEvent("data-changed", { bubbles: true, composed: true }));
  }

  private _createFirstNotification(): void {
    this.dispatchEvent(
      new CustomEvent("create-first-notification", { bubbles: true, composed: true }),
    );
  }

  private async _setPrimary(recipient: RecipientProfile, endpointId: string): Promise<void> {
    if (!this.api || this._busy || !this._canEdit(recipient)) return;
    this._busy = true;
    try {
      await this.api.updateRecipient({
        ...recipient,
        preferences: { ...recipient.preferences, preferred_endpoint_id: endpointId },
      });
      this._feedback = `${recipient.display_name}'s primary phone was updated.`;
      this._changed();
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._busy = false;
    }
  }

  private async _test(recipient: RecipientProfile): Promise<void> {
    if (!this.api || this._busy) return;
    this._busy = true;
    this._feedback = "";
    this._error = "";
    try {
      const result = await this.api.testRecipient(recipient.id);
      this._feedback =
        result.status === "SENT"
          ? `Test sent to ${recipient.display_name}.`
          : result.reason ?? `${recipient.display_name} does not currently have a usable phone.`;
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._busy = false;
    }
  }

  private async _confirmMapping(mapping: UnconfirmedRecipientMapping): Promise<void> {
    if (!this.api || this._busy || !this.currentUser?.is_admin) return;
    const defaultUserId = mapping.candidate_user_ids[0];
    const defaultRecipient = this.recipients.find((item) => item.ha_user_id === defaultUserId);
    const recipientId = this._mappingRecipientIds[mapping.source] ?? defaultRecipient?.id ?? "";
    if (!recipientId) {
      this._error = "Choose the household member who owns this phone or person profile.";
      return;
    }
    this._busy = true;
    try {
      await this.api.confirmRecipientMapping(mapping.source, recipientId);
      this._feedback = `${mapping.display_name} was confirmed.`;
      this._changed();
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._busy = false;
    }
  }

  private _startGroup(group?: RecipientGroup): void {
    this._editingGroupId = group?.id ?? "new";
    this._groupName = group?.name ?? "";
    this._groupMembers = group?.member_recipient_ids ?? [];
    this._error = "";
  }

  private async _saveGroup(): Promise<void> {
    if (!this.api || this._busy || !this._groupName.trim()) return;
    this._busy = true;
    try {
      const existing = this.groups.find((group) => group.id === this._editingGroupId);
      const group: RecipientGroup = {
        id: existing?.id ?? newRuleId().replace(/^rule-/, "group-"),
        name: this._groupName.trim(),
        type: "CUSTOM",
        member_recipient_ids: this._groupMembers,
        system_type: null,
      };
      if (existing) await this.api.updateGroup(group);
      else await this.api.createGroup(group);
      this._editingGroupId = "";
      this._feedback = `${group.name} was saved.`;
      this._changed();
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._busy = false;
    }
  }

  private async _deleteGroup(group: RecipientGroup): Promise<void> {
    if (!this.api || this._busy) return;
    if (!globalThis.confirm?.(`Delete the group “${group.name}”?`)) return;
    this._busy = true;
    try {
      await this.api.deleteGroup(group.id);
      this._changed();
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._busy = false;
    }
  }

  private _renderGroupForm() {
    return html`
      <div class="group-form">
        <label>
          Group name
          <input
            type="text"
            .value=${this._groupName}
            @input=${(event: Event) =>
              (this._groupName = (event.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <div>
          <strong>People</strong>
          <div class="member-grid">
            ${this.recipients.map(
              (recipient) => html`
                <label>
                  <input
                    type="checkbox"
                    .checked=${this._groupMembers.includes(recipient.id)}
                    @change=${(event: Event) => {
                      const checked = (event.currentTarget as HTMLInputElement).checked;
                      this._groupMembers = checked
                        ? [...new Set([...this._groupMembers, recipient.id])]
                        : this._groupMembers.filter((id) => id !== recipient.id);
                    }}
                  />
                  ${recipient.display_name}
                </label>
              `,
            )}
          </div>
        </div>
        <div class="actions">
          <notification-manager-button variant="primary" @click=${this._saveGroup}>
            Save group
          </notification-manager-button>
          <notification-manager-button @click=${() => (this._editingGroupId = "")}>
            Cancel
          </notification-manager-button>
        </div>
      </div>
    `;
  }

  render() {
    const customGroups = this.groups.filter((group) => group.type === "CUSTOM");
    const systemGroups = this.groups.filter((group) => group.type === "SYSTEM");
    const readyPhoneCount = this.recipients.reduce(
      (count, recipient) => count + this._activeEndpointCount(recipient),
      0,
    );
    const defaultOpenRecipientId = this.onboarding
      ? (this.recipients.find(
          (recipient) => recipient.ha_user_id === this.currentUser?.id,
        )?.id ?? this.recipients[0]?.id ?? "")
      : "";
    const openRecipientId = this._openRecipientId || defaultOpenRecipientId;
    return html`
      <div class="page-heading">
        <h2>Household</h2>
        <p>Manage who receives notifications and which phone is used.</p>
      </div>

      ${this.onboarding
        ? html`
            <notification-manager-status-panel
              kind=${readyPhoneCount > 0 ? "success" : "info"}
              heading=${readyPhoneCount > 0
                ? "Your household is ready"
                : "Let's connect your first phone"}
              message=${readyPhoneCount > 0
                ? `${readyPhoneCount} notification ${
                    readyPhoneCount === 1 ? "phone is" : "phones are"
                  } ready. You can send a test below, then create your first notification.`
                : "Notification Manager checks Home Assistant for Companion App phones automatically. If no phone appears, sign in to this Home Assistant from the Companion App and return here."}
            >
              ${readyPhoneCount > 0
                ? html`
                    <notification-manager-button
                      slot="actions"
                      icon="mdi:plus"
                      @click=${this._createFirstNotification}
                    >
                      Create first notification
                    </notification-manager-button>
                  `
                : nothing}
            </notification-manager-status-panel>
          `
        : nothing}

      ${this.unconfirmedMappings.length > 0
        ? html`
            <notification-manager-status-panel
              kind="info"
              heading="Set up your household"
              message=${`${this.unconfirmedMappings.length} possible phone ${
                this.unconfirmedMappings.length === 1 ? "match needs" : "matches need"
              } administrator confirmation. Review each person below.`}
            ></notification-manager-status-panel>
          `
        : nothing}
      ${this.unconfirmedMappings.length > 0 && this.currentUser?.is_admin
        ? html`
            <div class="mapping-list" aria-label="Mappings to confirm">
              ${this.unconfirmedMappings.map((mapping) => {
                const candidateRecipients = mapping.candidate_user_ids.length
                  ? this.recipients.filter((recipient) =>
                      mapping.candidate_user_ids.includes(recipient.ha_user_id),
                    )
                  : this.recipients;
                const fallback = candidateRecipients[0]?.id ?? "";
                return html`
                  <div class="mapping-row">
                    <div>
                      <span class="row-primary">${mapping.display_name}</span>
                      <span class="row-secondary">
                        ${mapping.source_type === "phone"
                          ? "Choose who owns this phone"
                          : "Choose the matching household member"}
                      </span>
                    </div>
                    <select
                      aria-label=${`Owner for ${mapping.display_name}`}
                      .value=${this._mappingRecipientIds[mapping.source] ?? fallback}
                      @change=${(event: Event) => {
                        this._mappingRecipientIds = {
                          ...this._mappingRecipientIds,
                          [mapping.source]: (event.currentTarget as HTMLSelectElement).value,
                        };
                      }}
                    >
                      <option value="">Choose a person</option>
                      ${candidateRecipients.map(
                        (recipient) => html`
                          <option value=${recipient.id}>${recipient.display_name}</option>
                        `,
                      )}
                    </select>
                    <notification-manager-button
                      .disabled=${this._busy}
                      @click=${() => void this._confirmMapping(mapping)}
                    >
                      Confirm
                    </notification-manager-button>
                  </div>
                `;
              })}
            </div>
          `
        : nothing}
      ${this._error ? html`<p class="feedback error" role="alert">${this._error}</p>` : nothing}
      ${this._feedback ? html`<p class="feedback" aria-live="polite">${this._feedback}</p>` : nothing}

      <section class="section" aria-labelledby="people-heading">
        <div class="section-heading">
          <h3 id="people-heading">People and phones</h3>
        </div>
        ${this.recipients.length === 0
          ? html`
              <notification-manager-empty-state
                icon="mdi:account-outline"
                heading="No household members found"
                message="Active Home Assistant users will appear here after discovery."
              ></notification-manager-empty-state>
            `
          : html`
              <div aria-label="Household recipients">
                ${this.recipients.map((recipient) => {
                  const open = openRecipientId === recipient.id;
                  const active = this._activeEndpointCount(recipient);
                  return html`
                    <article class="person">
                      <div class="person-row">
                        <button
                          class="person-main"
                          type="button"
                          aria-expanded=${open}
                          @click=${() =>
                            (this._openRecipientId = open ? "__closed__" : recipient.id)}
                        >
                          <span class="person-name">${recipient.display_name}</span>
                          <span class="person-device">
                            ${active
                              ? `${active} ${active === 1 ? "phone" : "phones"} ready`
                              : "No notification phone"}
                          </span>
                        </button>
                        <ha-icon
                          icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}
                          aria-hidden="true"
                        ></ha-icon>
                      </div>
                      ${open
                        ? html`
                            <div class="profile">
                              ${recipient.endpoints.length
                                ? html`
                                    <p class="hint">Primary notification device</p>
                                    <div class="endpoint-list">
                                      ${recipient.endpoints.map(
                                        (endpoint, index) => html`
                                          <label class="endpoint">
                                            <input
                                              type="radio"
                                              name=${`primary-${recipient.id}`}
                                              .checked=${
                                                recipient.preferences.preferred_endpoint_id ===
                                                  endpoint.id ||
                                                (!recipient.preferences.preferred_endpoint_id &&
                                                  index === 0)
                                              }
                                              ?disabled=${!endpoint.enabled || !this._canEdit(recipient)}
                                              @change=${() => void this._setPrimary(recipient, endpoint.id)}
                                            />
                                            ${recipient.endpoints.length === 1
                                              ? `${recipient.display_name}'s phone`
                                              : `${recipient.display_name}'s phone ${index + 1}`}
                                            ${endpoint.enabled ? "" : " (unavailable)"}
                                          </label>
                                        `,
                                      )}
                                    </div>
                                  `
                                : html`<p class="hint">No phone is currently mapped to this person.</p>`}
                              <notification-manager-button
                                .disabled=${this._busy || active === 0 || !this._canEdit(recipient)}
                                @click=${() => void this._test(recipient)}
                              >
                                Send test
                              </notification-manager-button>
                            </div>
                          `
                        : nothing}
                    </article>
                  `;
                })}
              </div>
            `}
      </section>

      <section class="section" aria-labelledby="groups-heading">
        <div class="section-heading-row">
          <div class="section-heading">
            <h3 id="groups-heading">Groups</h3>
            <p>Rules follow current group membership, so phones can change without editing rules.</p>
          </div>
          ${this.currentUser?.is_admin
            ? html`
                <notification-manager-button icon="mdi:plus" @click=${() => this._startGroup()}>
                  New group
                </notification-manager-button>
              `
            : nothing}
        </div>
        ${this._editingGroupId === "new" ? this._renderGroupForm() : nothing}
        <div aria-label="Notification groups">
          ${[...systemGroups, ...customGroups].map((group) => {
            const memberCount =
              group.system_type === "EVERYONE"
                ? this.recipients.length
                : group.member_recipient_ids.length;
            const membership =
              group.system_type === "ADMINS"
                ? "current administrators"
                : `${memberCount} ${memberCount === 1 ? "person" : "people"}`;
            return html`
              <article class="group">
                <div class="group-row">
                  <div>
                    <span class="row-primary">${group.name}</span>
                    <span class="row-secondary">
                      ${group.type === "SYSTEM" ? "Updates automatically" : "Custom group"},
                      ${membership}
                    </span>
                  </div>
                  ${group.type === "CUSTOM" && this.currentUser?.is_admin
                    ? html`
                        <div class="group-actions">
                          <notification-manager-button
                            variant="quiet"
                            @click=${() => this._startGroup(group)}
                          >
                            Edit
                          </notification-manager-button>
                          <notification-manager-button
                            variant="danger"
                            .disabled=${this._busy}
                            @click=${() => void this._deleteGroup(group)}
                          >
                            Delete
                          </notification-manager-button>
                        </div>
                      `
                    : nothing}
                </div>
                ${this._editingGroupId === group.id ? this._renderGroupForm() : nothing}
              </article>
            `;
          })}
        </div>
      </section>
    `;
  }
}

if (!customElements.get("notification-manager-people-groups-page")) {
  customElements.define("notification-manager-people-groups-page", PeopleGroupsPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-people-groups-page": PeopleGroupsPage;
  }
}
