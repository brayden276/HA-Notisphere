import { LitElement, html } from "lit";

import type {
  CapabilityTarget,
  CurrentUser,
  UnconfirmedRecipientMapping,
} from "../models";
import { pageStyles } from "./page-styles";

export class SettingsPage extends LitElement {
  static properties = {
    currentUser: { attribute: false },
    capabilityTargets: { attribute: false },
    unconfirmedMappings: { attribute: false },
  };

  static styles = [pageStyles];

  currentUser: CurrentUser | undefined;
  capabilityTargets: CapabilityTarget[] = [];
  unconfirmedMappings: UnconfirmedRecipientMapping[] = [];

  render() {
    const availableTargets = this.capabilityTargets.filter((target) => target.available).length;
    return html`
      <div class="page-heading">
        <h2>Settings</h2>
        <p>Review Notification Manager discovery and integration status.</p>
      </div>

      <section class="section" aria-labelledby="integration-heading">
        <div class="section-heading">
          <h3 id="integration-heading">Integration</h3>
        </div>
        <dl class="definition-list">
          <dt>Signed in as</dt>
          <dd>${this.currentUser?.name || "Home Assistant administrator"}</dd>
          <dt>Capability targets</dt>
          <dd>${availableTargets} of ${this.capabilityTargets.length} available</dd>
          <dt>Recipient mappings to confirm</dt>
          <dd>${this.unconfirmedMappings.length}</dd>
        </dl>
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
