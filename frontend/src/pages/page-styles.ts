import { css } from "lit";

export const pageStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    --nm-border: var(--divider-color, rgba(127, 127, 127, 0.3));
    --nm-control-border: var(--input-idle-line-color, rgba(127, 127, 127, 0.5));
    --nm-surface: var(--card-background-color, #fafafa);
    --nm-muted-surface: var(--secondary-background-color, #f1f1f1);
    --nm-space-1: 4px;
    --nm-space-2: 8px;
    --nm-space-3: 12px;
    --nm-space-4: 16px;
    --nm-space-5: 24px;
    --nm-space-6: 32px;
    --nm-control-height: 44px;
    --nm-option-height: 52px;
    --nm-row-height: 64px;
    --nm-row-height-comfortable: 72px;
    --nm-radius: 8px;
    --nm-radius-compact: 6px;
    max-inline-size: 1120px;
    margin-inline: auto;
    border: 1px solid var(--nm-border);
    border-radius: var(--nm-radius);
    padding: var(--nm-space-5);
    background: var(--nm-surface);
    color: var(--primary-text-color, #212121);
    font: inherit;
  }

  .page-heading {
    margin-bottom: var(--nm-space-4);
    padding-bottom: var(--nm-space-4);
    border-bottom: 1px solid var(--nm-border);
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 26px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  h3 {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.35;
  }

  .page-heading p,
  .section-heading p {
    max-inline-size: 65ch;
    margin-top: 6px;
    color: var(--secondary-text-color, #616161);
    font-size: 14px;
    line-height: 1.5;
  }

  .section + .section {
    margin-top: var(--nm-space-4);
    border-top: 1px solid var(--nm-border);
    padding-top: var(--nm-space-4);
  }

  .section {
    min-inline-size: 0;
  }

  .page-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nm-space-3);
    margin-bottom: var(--nm-space-4);
  }

  .section-heading {
    margin-bottom: var(--nm-space-3);
  }

  .data-list {
    border-top: 1px solid var(--nm-border);
  }

  .data-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--nm-space-4);
    min-block-size: var(--nm-row-height);
    border-bottom: 1px solid var(--nm-border);
    padding: 10px 0;
  }

  .row-primary,
  .row-secondary {
    display: block;
  }

  .row-primary {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.4;
  }

  .row-secondary,
  .row-meta {
    color: var(--secondary-text-color, #616161);
    font-size: 13px;
    line-height: 1.45;
  }

  .row-secondary {
    margin-top: 2px;
  }

  .row-meta {
    text-align: end;
  }

  .status {
    display: inline-block;
    border: 1px solid var(--nm-border);
    border-radius: var(--nm-radius-compact);
    padding: 3px 7px;
    background: var(--nm-muted-surface);
    color: var(--primary-text-color, #212121);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
  }

  .status[data-status="FAILED"],
  .status[data-status="NEEDS_ATTENTION"] {
    color: var(--error-color, #c62828);
  }

  .status[data-status="PARTIAL"],
  .status[data-status="DEGRADED"] {
    color: var(--warning-color, #8a5a00);
  }

  .definition-list {
    display: grid;
    grid-template-columns: minmax(160px, 0.45fr) minmax(0, 1fr);
    margin: 0;
    border-top: 1px solid var(--nm-border);
  }

  dt,
  dd {
    margin: 0;
    border-bottom: 1px solid var(--nm-border);
    padding: 14px 0;
    font-size: 14px;
    line-height: 1.45;
  }

  dt {
    color: var(--secondary-text-color, #616161);
  }

  dd {
    color: var(--primary-text-color, #212121);
    text-align: end;
  }

  input:not([type="checkbox"]):not([type="radio"]),
  select,
  textarea {
    box-sizing: border-box;
    min-block-size: var(--nm-control-height);
    border: 1px solid var(--nm-control-border);
    border-radius: var(--nm-radius);
    padding: 9px 11px;
    background: var(--nm-surface);
    color: var(--primary-text-color, #212121);
    font: inherit;
  }

  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--primary-color, #3f6f58);
    outline-offset: 2px;
  }

  .hint,
  .feedback {
    color: var(--secondary-text-color, #616161);
    font-size: 13px;
    line-height: 1.45;
  }

  .error {
    color: var(--error-color, #c62828);
  }

  @media (max-width: 600px) {
    :host {
      border-inline: 0;
      border-radius: 0;
      padding: var(--nm-space-4);
    }

    .page-heading {
      margin-bottom: var(--nm-space-5);
    }

    .data-row {
      grid-template-columns: 1fr;
      gap: 6px;
      min-block-size: var(--nm-row-height-comfortable);
    }

    .row-meta {
      text-align: start;
    }

    .definition-list {
      grid-template-columns: 1fr;
    }

    dt {
      border-bottom: 0;
      padding-bottom: 2px;
    }

    dd {
      padding-top: 2px;
      text-align: start;
    }
  }
`;
