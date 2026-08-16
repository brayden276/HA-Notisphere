import { LitElement, css, html } from "lit";

const ICONS = {
  error: "mdi:alert-circle-outline",
  offline: "mdi:connection",
  info: "mdi:information-outline",
} as const;

export class NotificationManagerStatusPanel extends LitElement {
  static properties = {
    kind: { type: String, reflect: true },
    heading: { type: String },
    message: { type: String },
    compact: { type: Boolean, reflect: true },
  };

  static styles = css`
    :host {
      display: block;
      color: var(--primary-text-color, #212121);
      font: inherit;
    }

    .panel {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      border-radius: 8px;
      padding: 16px;
      background: var(--card-background-color, #fafafa);
    }

    :host([kind="error"]) .panel {
      border-color: var(--error-color, #c62828);
    }

    :host([kind="offline"]) .panel {
      background: var(--secondary-background-color, #f1f1f1);
    }

    :host([compact]) .panel {
      border-radius: 0;
      border-inline: 0;
      padding: 10px 24px;
    }

    ha-icon {
      --mdc-icon-size: 22px;
      color: var(--secondary-text-color, #616161);
    }

    :host([kind="error"]) ha-icon {
      color: var(--error-color, #c62828);
    }

    strong,
    p {
      display: block;
      margin: 0;
    }

    strong {
      font-size: 15px;
      line-height: 1.35;
    }

    p {
      margin-top: 2px;
      color: var(--secondary-text-color, #616161);
      font-size: 14px;
      line-height: 1.45;
    }

    .actions {
      justify-self: end;
    }

    @media (max-width: 600px) {
      .panel {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .actions {
        grid-column: 2;
        justify-self: start;
      }

      :host([compact]) .panel {
        padding-inline: 16px;
      }
    }
  `;

  kind: keyof typeof ICONS = "info";
  heading = "";
  message = "";
  compact = false;

  render() {
    const role = this.kind === "error" ? "alert" : "status";
    return html`
      <div class="panel" role=${role} aria-live="polite">
        <ha-icon icon=${ICONS[this.kind]} aria-hidden="true"></ha-icon>
        <div>
          <strong>${this.heading}</strong>
          ${this.message ? html`<p>${this.message}</p>` : null}
        </div>
        <div class="actions"><slot name="actions"></slot></div>
      </div>
    `;
  }
}

if (!customElements.get("notification-manager-status-panel")) {
  customElements.define("notification-manager-status-panel", NotificationManagerStatusPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-status-panel": NotificationManagerStatusPanel;
  }
}
