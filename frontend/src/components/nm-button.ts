import { LitElement, css, html } from "lit";

export class NotificationManagerButton extends LitElement {
  static properties = {
    variant: { type: String, reflect: true },
    icon: { type: String },
    disabled: { type: Boolean, reflect: true },
    buttonType: { type: String, attribute: "button-type" },
  };

  static styles = css`
    :host {
      display: inline-block;
      font: inherit;
    }

    button {
      box-sizing: border-box;
      min-block-size: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      border-radius: 8px;
      padding: 0 16px;
      background: var(--card-background-color, #fafafa);
      color: var(--primary-text-color, #212121);
      font: inherit;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color 140ms ease,
        border-color 140ms ease;
    }

    :host([variant="primary"]) button {
      border-color: var(--primary-color, #3f6f58);
      background: var(--primary-color, #3f6f58);
      color: var(--text-primary-color, #f7f7f7);
    }

    button:hover:not(:disabled) {
      background: var(--secondary-background-color, #f1f1f1);
    }

    :host([variant="primary"]) button:hover:not(:disabled) {
      background: var(--dark-primary-color, var(--primary-color, #365f4d));
    }

    button:focus-visible {
      outline: 3px solid var(--primary-color, #3f6f58);
      outline-offset: 2px;
    }

    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    ha-icon {
      --mdc-icon-size: 20px;
      inline-size: 20px;
      block-size: 20px;
      flex: none;
    }

    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;

  variant: "primary" | "secondary" = "secondary";
  icon = "";
  disabled = false;
  buttonType: "button" | "submit" | "reset" = "button";

  render() {
    return html`
      <button type=${this.buttonType} ?disabled=${this.disabled}>
        ${this.icon
          ? html`<ha-icon icon=${this.icon} aria-hidden="true"></ha-icon>`
          : null}
        <slot></slot>
      </button>
    `;
  }
}

if (!customElements.get("notification-manager-button")) {
  customElements.define("notification-manager-button", NotificationManagerButton);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-button": NotificationManagerButton;
  }
}
