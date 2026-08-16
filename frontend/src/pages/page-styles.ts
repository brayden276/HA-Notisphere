import { css } from "lit";

export const pageStyles = css`
  :host {
    display: block;
    color: var(--primary-text-color, #212121);
    font: inherit;
  }

  .page-heading {
    margin-bottom: 28px;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 24px;
    font-weight: 500;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  h3 {
    font-size: 18px;
    font-weight: 500;
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
    margin-top: 36px;
  }

  .section-heading {
    margin-bottom: 14px;
  }

  .data-list {
    border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
  }

  .data-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    min-block-size: 64px;
    border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
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
    border-radius: 8px;
    padding: 3px 7px;
    background: var(--secondary-background-color, #f1f1f1);
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
    border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
  }

  dt,
  dd {
    margin: 0;
    border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
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

  @media (max-width: 600px) {
    .page-heading {
      margin-bottom: 24px;
    }

    .data-row {
      grid-template-columns: 1fr;
      gap: 6px;
      min-block-size: 72px;
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
