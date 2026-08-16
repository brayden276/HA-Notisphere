import { LitElement, css, html } from "lit";

export class NotificationManagerEmptyState extends LitElement {
  static properties = {
    icon: { type: String },
    heading: { type: String },
    message: { type: String },
  };

  static styles = css`
    :host {
      display: block;
      color: var(--primary-text-color, #212121);
      font: inherit;
    }

    .empty {
      display: grid;
      justify-items: start;
      gap: 8px;
      border-block: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      padding: 32px 0;
    }

    ha-icon {
      --mdc-icon-size: 28px;
      color: var(--secondary-text-color, #616161);
    }

    strong,
    p {
      margin: 0;
    }

    strong {
      font-size: 16px;
      line-height: 1.35;
    }

    p {
      max-inline-size: 58ch;
      color: var(--secondary-text-color, #616161);
      font-size: 14px;
      line-height: 1.5;
    }
  `;

  icon = "mdi:information-outline";
  heading = "";
  message = "";

  render() {
    return html`
      <div class="empty">
        <ha-icon icon=${this.icon} aria-hidden="true"></ha-icon>
        <strong>${this.heading}</strong>
        <p>${this.message}</p>
      </div>
    `;
  }
}

if (!customElements.get("notification-manager-empty-state")) {
  customElements.define("notification-manager-empty-state", NotificationManagerEmptyState);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-empty-state": NotificationManagerEmptyState;
  }
}
