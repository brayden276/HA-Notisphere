import { LitElement, css, html, nothing, type PropertyValues } from "lit";

import type { NotificationManagerApi } from "../api";
import { normaliseApiError } from "../api";
import "../components/nm-button";
import "../components/nm-status-panel";
import type {
  CapabilityTarget,
  CurrentUser,
  SettingsData,
  UnconfirmedRecipientMapping,
} from "../models";
import { pageStyles } from "./page-styles";

export class SettingsPage extends LitElement {
  static properties = {
    api: { attribute: false },
    currentUser: { attribute: false },
    capabilityTargets: { attribute: false },
    unconfirmedMappings: { attribute: false },
    _days: { state: true },
    _error: { state: true },
    _loading: { state: true },
    _records: { state: true },
    _settings: { state: true },
    _status: { state: true },
  };

  static styles = [
    pageStyles,
    css`
      .settings-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 180px)) auto;
        align-items: end;
        gap: 12px;
        margin-top: 14px;
      }

      label { display: grid; gap: 5px; font-weight: 600; }

      input {
        min-block-size: 44px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.45));
        border-radius: 8px;
        padding: 0 10px;
        background: var(--card-background-color, #fafafa);
        color: inherit;
        font: inherit;
      }

      input:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .feedback { margin-top: 10px; color: var(--secondary-text-color, #616161); }
      .error { color: var(--error-color, #c62828); }

      @media (max-width: 600px) {
        .settings-form { grid-template-columns: 1fr; }
      }
    `,
  ];

  api: NotificationManagerApi | undefined;
  currentUser: CurrentUser | undefined;
  capabilityTargets: CapabilityTarget[] = [];
  unconfirmedMappings: UnconfirmedRecipientMapping[] = [];
  private _settings: SettingsData | undefined;
  private _days = 30;
  private _records = 1000;
  private _loading = false;
  private _error = "";
  private _status = "";

  protected updated(changed: PropertyValues): void {
    if (changed.has("api") && this.api && !this._settings) {
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    if (!this.api || this._loading) return;
    this._loading = true;
    try {
      this._settings = await this.api.getSettings();
      this._days = this._settings.activity_retention.days;
      this._records = this._settings.activity_retention.records;
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._loading = false;
    }
  }

  private async _save(): Promise<void> {
    if (!this.api || this._loading) return;
    this._loading = true;
    this._error = "";
    this._status = "";
    try {
      const retention = await this.api.updateSettings(this._days, this._records);
      if (this._settings) this._settings = { ...this._settings, activity_retention: retention };
      this._status = "Activity retention was updated.";
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._loading = false;
    }
  }

  render() {
    const availableTargets = this.capabilityTargets.filter((target) => target.available).length;
    const diagnostics = this._settings?.diagnostics;
    return html`
      <div class="page-heading">
        <h2>Settings</h2>
        <p>Manage activity history and check that Notification Manager is ready.</p>
      </div>

      <section class="section" aria-labelledby="integration-heading">
        <div class="section-heading">
          <h3 id="integration-heading">Overview</h3>
        </div>
        <dl class="definition-list">
          <dt>Signed in as</dt>
          <dd>${this.currentUser?.name || "Home Assistant administrator"}</dd>
          <dt>Available devices</dt>
          <dd>${availableTargets} of ${this.capabilityTargets.length} available</dd>
          <dt>Phone matches to review</dt>
          <dd>${this.unconfirmedMappings.length}</dd>
        </dl>
      </section>

      <section class="section" aria-labelledby="health-heading">
        <div class="section-heading">
          <h3 id="health-heading">System status</h3>
        </div>
        ${this._loading && !diagnostics
          ? html`<p>Loading integration status…</p>`
          : diagnostics
            ? html`
                <dl class="definition-list">
                  <dt>Version</dt>
                  <dd>${diagnostics.version}</dd>
                  <dt>Notifications on</dt>
                  <dd>${diagnostics.rules.enabled} of ${diagnostics.rules.total}</dd>
                  <dt>Needs attention</dt>
                  <dd>${diagnostics.rules.health.NEEDS_ATTENTION}</dd>
                  <dt>Household phones</dt>
                  <dd>
                    ${diagnostics.discovery.recipients} people,
                    ${diagnostics.discovery.enabled_endpoints} ready phones
                  </dd>
                  <dt>Notification engine</dt>
                  <dd>
                    ${diagnostics.runtime.attached
                      ? `Running, ${diagnostics.runtime.watched_rules} active, ${diagnostics.runtime.pending_timers} waiting`
                      : "Not running"}
                  </dd>
                </dl>
              `
            : nothing}
      </section>

      <section class="section" aria-labelledby="retention-heading">
        <div class="section-heading">
          <h3 id="retention-heading">Activity history</h3>
          <p>Older activity is removed when either limit is reached.</p>
        </div>
        <div class="settings-form">
          <label>
            Keep for days
            <input
              type="number"
              min="1"
              max="3650"
              .value=${String(this._days)}
              @input=${(event: Event) =>
                (this._days = Number((event.currentTarget as HTMLInputElement).value))}
            />
          </label>
          <label>
            Maximum entries
            <input
              type="number"
              min="1"
              max="1000"
              .value=${String(this._records)}
              @input=${(event: Event) =>
                (this._records = Number((event.currentTarget as HTMLInputElement).value))}
            />
          </label>
          <notification-manager-button
            variant="primary"
            .disabled=${this._loading}
            @click=${this._save}
          >
            Save
          </notification-manager-button>
        </div>
        ${this._error ? html`<p class="feedback error" role="alert">${this._error}</p>` : nothing}
        ${this._status ? html`<p class="feedback" aria-live="polite">${this._status}</p>` : nothing}
      </section>
    `;
  }
}

if (!customElements.get("notification-manager-settings-page")) {
  customElements.define("notification-manager-settings-page", SettingsPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-settings-page": SettingsPage;
  }
}
