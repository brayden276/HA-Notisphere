import { LitElement, html } from "lit";

import "../components/nm-empty-state";
import type {
  RecipientGroup,
  RecipientProfile,
  UnconfirmedRecipientMapping,
} from "../models";
import { pageStyles } from "./page-styles";

export class PeopleGroupsPage extends LitElement {
  static properties = {
    recipients: { attribute: false },
    groups: { attribute: false },
    unconfirmedMappings: { attribute: false },
  };

  static styles = [pageStyles];

  recipients: RecipientProfile[] = [];
  groups: RecipientGroup[] = [];
  unconfirmedMappings: UnconfirmedRecipientMapping[] = [];

  private activeEndpointLabel(recipient: RecipientProfile): string {
    const count = recipient.endpoints.filter((endpoint) => endpoint.enabled).length;
    return `${count} active ${count === 1 ? "endpoint" : "endpoints"}`;
  }

  render() {
    return html`
      <div class="page-heading">
        <h2>People &amp; Groups</h2>
        <p>See who can receive notifications and how household groups are organised.</p>
      </div>

      <section class="section" aria-labelledby="people-heading">
        <div class="section-heading">
          <h3 id="people-heading">People</h3>
        </div>
        ${this.recipients.length === 0
          ? html`
              <notification-manager-empty-state
                icon="mdi:account-outline"
                heading="No recipients found"
                message="Recipients will appear after Home Assistant user and mobile app discovery completes."
              ></notification-manager-empty-state>
            `
          : html`
              <div class="data-list" aria-label="Recipients">
                ${this.recipients.map(
                  (recipient) => html`
                    <div class="data-row">
                      <div>
                        <span class="row-primary">${recipient.display_name}</span>
                        <span class="row-secondary">
                          ${recipient.person_entity_id ?? "No linked person entity"}
                        </span>
                      </div>
                      <span class="row-meta">${this.activeEndpointLabel(recipient)}</span>
                    </div>
                  `,
                )}
              </div>
            `}
      </section>

      <section class="section" aria-labelledby="groups-heading">
        <div class="section-heading">
          <h3 id="groups-heading">Groups</h3>
        </div>
        ${this.groups.length === 0
          ? html`
              <notification-manager-empty-state
                icon="mdi:account-group-outline"
                heading="No groups found"
                message="Household groups will appear here when they are available."
              ></notification-manager-empty-state>
            `
          : html`
              <div class="data-list" aria-label="Recipient groups">
                ${this.groups.map(
                  (group) => html`
                    <div class="data-row">
                      <div>
                        <span class="row-primary">${group.name}</span>
                        <span class="row-secondary">
                          ${group.type === "SYSTEM" ? "Home Assistant group" : "Custom group"}
                        </span>
                      </div>
                      <span class="row-meta">
                        ${group.member_recipient_ids.length}
                        ${group.member_recipient_ids.length === 1 ? "member" : "members"}
                      </span>
                    </div>
                  `,
                )}
              </div>
            `}
      </section>

      ${this.unconfirmedMappings.length > 0
        ? html`
            <section class="section" aria-labelledby="mapping-heading">
              <div class="section-heading">
                <h3 id="mapping-heading">Mappings to confirm</h3>
                <p>
                  ${this.unconfirmedMappings.length}
                  ${this.unconfirmedMappings.length === 1 ? "mapping needs" : "mappings need"}
                  administrator review.
                </p>
              </div>
            </section>
          `
        : null}
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
