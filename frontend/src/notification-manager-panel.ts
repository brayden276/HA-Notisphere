import { LitElement, css, html, nothing, type PropertyValues } from "lit";

import { NotificationManagerApi, normaliseApiError } from "./api";
import "./components/nm-button";
import "./components/nm-status-panel";
import type { HomeAssistant, HomeAssistantConnection, PanelConfig } from "./ha";
import type { BootstrapData } from "./models";
import {
  hrefForRoute,
  navigationForUser,
  routeForUser,
  routeFromHash,
  type AppRoute,
} from "./navigation";
import "./pages/activity-page";
import "./pages/notifications-page";
import "./pages/people-groups-page";
import "./pages/rule-detail-page";
import "./pages/rule-editor-page";
import "./pages/settings-page";

type LoadState = "idle" | "loading" | "ready" | "error";
type NotificationView = "list" | "create" | "detail" | "edit";

export interface HomeAssistantPanelInfo {
  config?: PanelConfig;
}

export class NotificationManagerPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    narrow: { type: Boolean, reflect: true },
    panel: { attribute: false },
    route: { attribute: false },
    _activeRoute: { state: true },
    _bootstrapData: { state: true },
    _connectedToHomeAssistant: { state: true },
    _errorMessage: { state: true },
    _loadState: { state: true },
    _notificationView: { state: true },
    _onboardingActive: { state: true },
    _selectedRuleId: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      min-block-size: 100%;
      background: var(--primary-background-color, #f6f6f6);
      color: var(--primary-text-color, #212121);
      font-family: var(
        --ha-font-family-body,
        var(--paper-font-body1_-_font-family, sans-serif)
      );
      font-size: 14px;
      line-height: 1.5;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .shell {
      min-block-size: 100%;
    }

    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-block-size: 56px;
      padding:
        max(8px, env(safe-area-inset-top))
        max(24px, env(safe-area-inset-right))
        8px
        max(24px, env(safe-area-inset-left));
      border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      background: var(--app-header-background-color, var(--card-background-color, #fafafa));
      color: var(--app-header-text-color, var(--primary-text-color, #212121));
    }

    .app-title {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      line-height: 1.3;
      letter-spacing: -0.01em;
    }

    .user-name {
      overflow: hidden;
      max-inline-size: 240px;
      color: var(--app-header-text-color, var(--primary-text-color, #212121));
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .navigation {
      overflow-x: auto;
      border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
      background: var(--card-background-color, #fafafa);
      scrollbar-width: thin;
    }

    .navigation-inner {
      display: flex;
      align-items: stretch;
      gap: 4px;
      max-inline-size: 1200px;
      min-inline-size: max-content;
      margin: 0 auto;
      padding: 0 24px;
    }

    .navigation a {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 48px;
      border-radius: 8px;
      padding: 0 12px;
      color: var(--secondary-text-color, #616161);
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      transition:
        background-color 140ms ease,
        color 140ms ease;
    }

    .navigation a::after {
      content: "";
      position: absolute;
      inset-inline: 10px;
      inset-block-end: 0;
      block-size: 2px;
      background: transparent;
    }

    .navigation a:hover {
      background: var(--secondary-background-color, #f1f1f1);
      color: var(--primary-text-color, #212121);
    }

    .navigation a[aria-current="page"] {
      color: var(--primary-text-color, #212121);
    }

    .navigation a[aria-current="page"]::after {
      background: var(--primary-color, #3f6f58);
    }

    .navigation a:focus-visible {
      outline: 3px solid var(--primary-color, #3f6f58);
      outline-offset: -3px;
    }

    .navigation ha-icon {
      --mdc-icon-size: 20px;
      inline-size: 20px;
      block-size: 20px;
      flex: none;
    }

    main {
      max-inline-size: 1200px;
      margin: 0 auto;
      padding:
        32px
        max(24px, env(safe-area-inset-right))
        max(48px, env(safe-area-inset-bottom))
        max(24px, env(safe-area-inset-left));
    }

    .state-container {
      max-inline-size: 720px;
    }

    .skeleton {
      display: grid;
      gap: 16px;
      max-inline-size: 760px;
      padding-top: 4px;
    }

    .skeleton-line,
    .skeleton-row {
      display: block;
      background: var(--secondary-background-color, #e9e9e9);
    }

    .skeleton-line {
      inline-size: min(240px, 60%);
      block-size: 24px;
      border-radius: 8px;
    }

    .skeleton-row {
      block-size: 64px;
      border-radius: 8px;
    }

    .sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      clip-path: inset(50%);
    }

    @media (max-width: 700px) {
      .app-header {
        padding-inline: max(16px, env(safe-area-inset-left));
      }

      .user-name {
        max-inline-size: 120px;
      }

      .navigation-inner {
        padding-inline: 8px;
      }

      .navigation a {
        min-block-size: 52px;
        padding-inline: 10px;
      }

      main {
        padding-block-start: 24px;
        padding-inline: max(16px, env(safe-area-inset-left));
      }
    }

    @media (max-width: 430px) {
      .user-name {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .navigation a {
        transition: none;
      }
    }
  `;

  hass: HomeAssistant | undefined;
  narrow = false;
  panel: HomeAssistantPanelInfo | undefined;
  route: unknown;

  private _activeRoute: AppRoute = routeFromHash(globalThis.location?.hash ?? "");
  private _bootstrapData: BootstrapData | undefined;
  private _connectedToHomeAssistant = globalThis.navigator?.onLine ?? true;
  private _errorMessage = "";
  private _loadState: LoadState = "idle";
  private _api: NotificationManagerApi | undefined;
  private _boundConnection: HomeAssistantConnection | undefined;
  private _loadGeneration = 0;
  private _notificationView: NotificationView = "list";
  private _onboardingActive = false;
  private _selectedRuleId = "";
  private _editorDirty = false;

  private readonly _handleHashChange = (): void => {
    const requested = routeFromHash(globalThis.location?.hash ?? "");
    if (!this._bootstrapData) {
      this._activeRoute = requested;
      return;
    }
    const route = routeForUser(requested, this._bootstrapData.current_user.is_admin);
    if (route !== "notifications" && this._editorDirty && !this._confirmDiscard()) {
      globalThis.history?.replaceState(null, "", hrefForRoute("notifications"));
      return;
    }
    this._activeRoute = route;
    if (route !== "notifications") {
      this._notificationView = "list";
      this._selectedRuleId = "";
    }
    if (route !== requested) {
      globalThis.history?.replaceState(null, "", hrefForRoute(route));
    }
  };

  private readonly _handleConnectionReady = (): void => {
    this._connectedToHomeAssistant = true;
    void this._loadBootstrap();
  };

  private readonly _handleConnectionLost = (): void => {
    this._connectedToHomeAssistant = false;
  };

  private readonly _handleOnline = (): void => {
    if (this.hass) {
      void this._loadBootstrap();
    }
  };

  private readonly _handleOffline = (): void => {
    this._connectedToHomeAssistant = false;
  };

  private readonly _handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!this._editorDirty) return;
    event.preventDefault();
    event.returnValue = "";
  };

  connectedCallback(): void {
    super.connectedCallback();
    globalThis.addEventListener?.("hashchange", this._handleHashChange);
    globalThis.addEventListener?.("popstate", this._handleHashChange);
    globalThis.addEventListener?.("online", this._handleOnline);
    globalThis.addEventListener?.("offline", this._handleOffline);
    globalThis.addEventListener?.("beforeunload", this._handleBeforeUnload);
    if (this.hass?.connection && this._boundConnection !== this.hass.connection) {
      this._bindConnection(this.hass.connection);
      this._api = new NotificationManagerApi(this.hass);
      void this._loadBootstrap();
    }
  }

  disconnectedCallback(): void {
    globalThis.removeEventListener?.("hashchange", this._handleHashChange);
    globalThis.removeEventListener?.("popstate", this._handleHashChange);
    globalThis.removeEventListener?.("online", this._handleOnline);
    globalThis.removeEventListener?.("offline", this._handleOffline);
    globalThis.removeEventListener?.("beforeunload", this._handleBeforeUnload);
    this._unbindConnection();
    this._api = undefined;
    super.disconnectedCallback();
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has("hass")) {
      const connection = this.hass?.connection;
      this._api = this.hass ? new NotificationManagerApi(this.hass) : undefined;
      if (connection && connection !== this._boundConnection) {
        this._bindConnection(connection);
        void this._loadBootstrap();
      } else if (!connection) {
        this._unbindConnection();
      }
    }
  }

  private _bindConnection(connection: HomeAssistantConnection): void {
    this._unbindConnection();
    this._boundConnection = connection;
    connection.addEventListener?.("ready", this._handleConnectionReady);
    connection.addEventListener?.("disconnected", this._handleConnectionLost);
    connection.addEventListener?.("reconnect-error", this._handleConnectionLost);
  }

  private _unbindConnection(): void {
    this._boundConnection?.removeEventListener?.("ready", this._handleConnectionReady);
    this._boundConnection?.removeEventListener?.("disconnected", this._handleConnectionLost);
    this._boundConnection?.removeEventListener?.(
      "reconnect-error",
      this._handleConnectionLost,
    );
    this._boundConnection = undefined;
  }

  private async _loadBootstrap(): Promise<void> {
    const api = this._api;
    if (!api) {
      this._loadState = "error";
      this._errorMessage = "Home Assistant is not available to this panel.";
      return;
    }

    const generation = ++this._loadGeneration;
    const hadData = this._bootstrapData !== undefined;
    if (!hadData) {
      this._loadState = "loading";
    }
    this._errorMessage = "";

    try {
      const data = await api.bootstrap();
      if (generation !== this._loadGeneration) {
        return;
      }
      this._bootstrapData = data;
      this._loadState = "ready";
      this._connectedToHomeAssistant = true;
      const needsHouseholdSetup =
        !hadData &&
        data.current_user.is_admin &&
        data.rules.length === 0 &&
        !this._onboardingWasCompleted(data.current_user.id);
      if (needsHouseholdSetup) {
        this._onboardingActive = true;
        this._activeRoute = "people";
        globalThis.history?.replaceState(null, "", hrefForRoute("people"));
        return;
      }
      const allowedRoute = routeForUser(this._activeRoute, data.current_user.is_admin);
      if (allowedRoute !== this._activeRoute) {
        this._activeRoute = allowedRoute;
        globalThis.history?.replaceState(null, "", hrefForRoute(allowedRoute));
      }
    } catch (error) {
      if (generation !== this._loadGeneration) {
        return;
      }
      const apiError = normaliseApiError(error);
      this._errorMessage = apiError.message;
      if (hadData) {
        this._loadState = "ready";
        this._connectedToHomeAssistant = false;
      } else {
        this._loadState = "error";
      }
    }
  }

  private _renderHeader() {
    return html`
      <header class="app-header">
        <h1 class="app-title">Notification Manager</h1>
        ${this._bootstrapData
          ? html`<span class="user-name">${this._bootstrapData.current_user.name}</span>`
          : nothing}
      </header>
    `;
  }

  private _renderNavigation(data: BootstrapData) {
    const items = navigationForUser(data.current_user.is_admin);
    return html`
      <nav class="navigation" aria-label="Notification Manager">
        <div class="navigation-inner">
          ${items.map(
            (item) => html`
              <a
                href=${hrefForRoute(item.route)}
                @click=${(event: Event) => {
                  event.preventDefault();
                  this._goToRoute(item.route);
                }}
                aria-current=${this._activeRoute === item.route ? "page" : nothing}
              >
                <ha-icon icon=${item.icon} aria-hidden="true"></ha-icon>
                <span>${item.label}</span>
              </a>
            `,
          )}
        </div>
      </nav>
    `;
  }

  private _confirmDiscard(): boolean {
    if (!this._editorDirty) return true;
    const discard = globalThis.confirm?.("Discard your unsaved notification changes?") ?? false;
    if (discard) this._editorDirty = false;
    return discard;
  }

  private _goToRoute(route: AppRoute): void {
    if (route !== "notifications" && !this._confirmDiscard()) return;
    this._activeRoute = route;
    if (route !== "notifications") this._notificationView = "list";
    globalThis.history?.pushState(null, "", hrefForRoute(route));
  }

  private _showNotification(view: NotificationView, ruleId = ""): void {
    if (this._editorDirty && !this._confirmDiscard()) return;
    this._activeRoute = "notifications";
    this._notificationView = view;
    this._selectedRuleId = ruleId;
    if (view !== "create" && view !== "edit") this._editorDirty = false;
    globalThis.history?.replaceState(null, "", hrefForRoute("notifications"));
  }

  private _onboardingWasCompleted(userId: string): boolean {
    try {
      return globalThis.localStorage?.getItem(this._onboardingStorageKey(userId)) === "complete";
    } catch {
      return false;
    }
  }

  private _onboardingStorageKey(userId: string): string {
    return `notification-manager:onboarding:${userId}`;
  }

  private _completeOnboardingAndCreate(): void {
    const userId = this._bootstrapData?.current_user.id;
    if (userId) {
      try {
        globalThis.localStorage?.setItem(this._onboardingStorageKey(userId), "complete");
      } catch {
        // Private browsing can deny local storage; the current session still proceeds.
      }
    }
    this._onboardingActive = false;
    this._showNotification("create");
  }

  private async _refreshData(): Promise<void> {
    await this._loadBootstrap();
  }

  private async _handleRuleSaved(event: CustomEvent<{ rule: { id: string } }>): Promise<void> {
    this._editorDirty = false;
    this._selectedRuleId = event.detail.rule.id;
    await this._refreshData();
    this._notificationView = "detail";
  }

  private _renderNotifications(data: BootstrapData) {
    const selected = data.rules.find((rule) => rule.id === this._selectedRuleId);
    if (this._notificationView === "create" || this._notificationView === "edit") {
      return html`
        <notification-manager-rule-editor-page
          .api=${this._api}
          .currentUser=${data.current_user}
          .rule=${this._notificationView === "edit" ? selected : undefined}
          .targets=${data.capability_targets}
          .recipients=${data.recipients}
          .groups=${data.groups}
          @editor-dirty=${(event: CustomEvent<{ dirty: boolean }>) =>
            (this._editorDirty = event.detail.dirty)}
          @editor-cancel=${() => this._showNotification("list")}
          @rule-saved=${(event: CustomEvent<{ rule: { id: string } }>) =>
            void this._handleRuleSaved(event)}
        ></notification-manager-rule-editor-page>
      `;
    }
    if (this._notificationView === "detail") {
      return html`
        <notification-manager-rule-detail-page
          .api=${this._api}
          .rule=${selected}
          .activity=${data.activity}
          .targets=${data.capability_targets}
          .recipients=${data.recipients}
          .groups=${data.groups}
          @detail-close=${() => this._showNotification("list")}
          @rule-edit=${() => this._showNotification("edit", this._selectedRuleId)}
          @rule-deleted=${() => {
            this._showNotification("list");
            void this._refreshData();
          }}
          @data-changed=${() => void this._refreshData()}
        ></notification-manager-rule-detail-page>
      `;
    }
    return html`
      <notification-manager-notifications-page
        .api=${this._api}
        .currentUser=${data.current_user}
        .rules=${data.rules}
        .targets=${data.capability_targets}
        .recipients=${data.recipients}
        .groups=${data.groups}
        @rule-create=${() => this._showNotification("create")}
        @rule-open=${(event: CustomEvent<{ ruleId: string }>) =>
          this._showNotification("detail", event.detail.ruleId)}
        @data-changed=${() => void this._refreshData()}
      ></notification-manager-notifications-page>
    `;
  }

  private _renderLoading() {
    return html`
      <main>
        <div class="skeleton" role="status" aria-busy="true">
          <span class="sr-only">Loading Notification Manager</span>
          <span class="skeleton-line"></span>
          <span class="skeleton-row"></span>
          <span class="skeleton-row"></span>
          <span class="skeleton-row"></span>
        </div>
      </main>
    `;
  }

  private _renderError() {
    return html`
      <main>
        <div class="state-container">
          <notification-manager-status-panel
            kind="error"
            heading="Could not load Notification Manager"
            .message=${this._errorMessage}
          >
            <notification-manager-button
              slot="actions"
              icon="mdi:refresh"
              @click=${() => void this._loadBootstrap()}
            >
              Retry
            </notification-manager-button>
          </notification-manager-status-panel>
        </div>
      </main>
    `;
  }

  private _renderPage(data: BootstrapData) {
    switch (this._activeRoute) {
      case "people":
        return html`
          <notification-manager-people-groups-page
            .api=${this._api}
            .currentUser=${data.current_user}
            .recipients=${data.recipients}
            .groups=${data.groups}
            .onboarding=${this._onboardingActive}
            .unconfirmedMappings=${data.unconfirmed_recipient_mappings}
            @data-changed=${() => void this._refreshData()}
            @create-first-notification=${() => this._completeOnboardingAndCreate()}
          ></notification-manager-people-groups-page>
        `;
      case "activity":
        return html`
          <notification-manager-activity-page
            .api=${this._api}
            .activity=${data.activity}
            .rules=${data.rules}
            .recipients=${data.recipients}
          ></notification-manager-activity-page>
        `;
      case "settings":
        return data.current_user.is_admin
          ? html`
              <notification-manager-settings-page
                .api=${this._api}
                .currentUser=${data.current_user}
                .capabilityTargets=${data.capability_targets}
                .unconfirmedMappings=${data.unconfirmed_recipient_mappings}
              ></notification-manager-settings-page>
            `
          : html`
              <notification-manager-notifications-page
                .api=${this._api}
                .currentUser=${data.current_user}
                .rules=${data.rules}
                .targets=${data.capability_targets}
                .recipients=${data.recipients}
                .groups=${data.groups}
              ></notification-manager-notifications-page>
            `;
      case "notifications":
      default:
        return this._renderNotifications(data);
    }
  }

  render() {
    const data = this._bootstrapData;
    return html`
      <div class="shell">
        ${this._renderHeader()}
        ${data ? this._renderNavigation(data) : nothing}
        ${data && !this._connectedToHomeAssistant
          ? html`
              <notification-manager-status-panel
                kind="offline"
                heading="Connection lost"
                message="Waiting for Home Assistant. Current data may be out of date."
                compact
              ></notification-manager-status-panel>
            `
          : nothing}
        ${this._loadState === "error"
          ? this._renderError()
          : !data || this._loadState === "loading"
            ? this._renderLoading()
            : html`<main id="main-content">${this._renderPage(data)}</main>`}
      </div>
    `;
  }
}

if (!customElements.get("notification-manager-panel")) {
  customElements.define("notification-manager-panel", NotificationManagerPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-panel": NotificationManagerPanel;
  }
}
