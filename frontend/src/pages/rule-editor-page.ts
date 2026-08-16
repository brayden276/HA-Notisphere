import { LitElement, css, html, nothing, type PropertyValues } from "lit";

import type { NotificationManagerApi } from "../api";
import { normaliseApiError } from "../api";
import "../components/nm-button";
import "../components/nm-status-panel";
import type {
  Audience,
  CapabilityTarget,
  ConditionSpec,
  CurrentUser,
  EndpointCapability,
  NotificationRule,
  RecipientGroup,
  RecipientProfile,
  Semantic,
  Urgency,
} from "../models";
import {
  createNotificationRule,
  generatedMessage,
  newRuleId,
  reviewSentence,
  semanticFromTrigger,
  supportedSemantics,
  supportedTargets,
} from "../rule-draft";
import { pageStyles } from "./page-styles";

type AudienceMode = "ME" | "EVERYONE" | "ADMINS" | "CHOOSE";
type ConditionMode = "NONE" | "PERSON_HOME" | "PERSON_AWAY" | "TIME_WINDOW";

const CATEGORY_LABELS: Record<string, string> = {
  opening: "Doors & windows",
  motion: "Motion",
};

function valueFrom(event: Event): string {
  return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value;
}

export class RuleEditorPage extends LitElement {
  static properties = {
    api: { attribute: false },
    currentUser: { attribute: false },
    rule: { attribute: false },
    targets: { attribute: false },
    recipients: { attribute: false },
    groups: { attribute: false },
    _audienceMode: { state: true },
    _conditionMode: { state: true },
    _durationMinutes: { state: true },
    _error: { state: true },
    _groupIds: { state: true },
    _name: { state: true },
    _recipientIds: { state: true },
    _saving: { state: true },
    _selectedSemantic: { state: true },
    _selectedTargetId: { state: true },
    _status: { state: true },
    _title: { state: true },
    _message: { state: true },
  };

  static styles = [
    pageStyles,
    css`
      :host {
        max-inline-size: 840px;
        margin-inline: auto;
      }

      .editor-header,
      .review-actions,
      .section-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .editor-header {
        margin-bottom: 24px;
      }

      .back {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 44px;
        border: 0;
        padding: 0;
        background: transparent;
        color: var(--primary-color, #3f6f58);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .back:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible,
      summary:focus-visible {
        outline: 3px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .composer-section {
        border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-block: 24px;
      }

      .section-number {
        display: inline-grid;
        place-items: center;
        inline-size: 26px;
        block-size: 26px;
        border-radius: 50%;
        background: var(--secondary-background-color, #ededed);
        color: var(--secondary-text-color, #616161);
        font-size: 12px;
        font-weight: 700;
      }

      .section-title-row h3 {
        flex: 1;
      }

      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 16px;
      }

      .field,
      .choice-group {
        display: grid;
        gap: 7px;
      }

      .field.full,
      .choice-group {
        grid-column: 1 / -1;
      }

      label,
      legend {
        color: var(--primary-text-color, #212121);
        font-size: 14px;
        font-weight: 600;
      }

      input,
      select,
      textarea {
        inline-size: 100%;
        min-block-size: 44px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.5));
        border-radius: 6px;
        padding: 9px 11px;
        background: var(--card-background-color, #fafafa);
        color: var(--primary-text-color, #212121);
        font: inherit;
      }

      textarea {
        min-block-size: 96px;
        resize: vertical;
      }

      .hint {
        margin: 0;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
      }

      fieldset {
        min-inline-size: 0;
        margin: 16px 0 0;
        border: 0;
        padding: 0;
      }

      .choice-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 8px;
      }

      .choice {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        min-block-size: 44px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
        border-radius: 6px;
        padding: 10px;
        font-weight: 500;
        cursor: pointer;
      }

      .choice:has(input:checked) {
        border-color: var(--primary-color, #3f6f58);
        background: color-mix(in srgb, var(--primary-color, #3f6f58) 8%, transparent);
      }

      .choice input {
        inline-size: 18px;
        min-block-size: 18px;
        block-size: 18px;
        margin: 1px 0 0;
        padding: 0;
      }

      .expanded-choice {
        margin-top: 12px;
        border-inline-start: 3px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-inline-start: 16px;
      }

      details {
        border-block: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-block: 4px;
      }

      summary {
        min-block-size: 48px;
        display: flex;
        align-items: center;
        font-weight: 600;
        cursor: pointer;
      }

      .review {
        border-inline-start: 4px solid var(--primary-color, #3f6f58);
        padding: 16px 18px;
        background: var(--secondary-background-color, #f1f1f1);
        font-size: 16px;
        line-height: 1.5;
      }

      .review-actions {
        align-items: flex-start;
        margin-top: 18px;
      }

      .button-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }

      .feedback {
        min-block-size: 22px;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
      }

      .error {
        color: var(--error-color, #c62828);
      }

      @media (max-width: 640px) {
        .field-grid,
        .choice-list {
          grid-template-columns: 1fr;
        }

        .review-actions {
          display: grid;
        }

        .button-row {
          justify-content: stretch;
        }

        .button-row notification-manager-button {
          flex: 1;
        }
      }
    `,
  ];

  api: NotificationManagerApi | undefined;
  currentUser: CurrentUser | undefined;
  rule: NotificationRule | undefined;
  targets: CapabilityTarget[] = [];
  recipients: RecipientProfile[] = [];
  groups: RecipientGroup[] = [];

  private _initialisedFor = "";
  private _draftId = newRuleId();
  private _selectedTargetId = "";
  private _selectedSemantic: Semantic | "" = "";
  private _durationMinutes = 5;
  private _audienceMode: AudienceMode = "ME";
  private _recipientIds: string[] = [];
  private _groupIds: string[] = [];
  private _name = "";
  private _title = "";
  private _message = "";
  private _contentEdited = false;
  private _conditionMode: ConditionMode = "NONE";
  private _conditionTargetId = "";
  private _conditionStart = "22:00";
  private _conditionEnd = "06:00";
  private _urgency: Urgency = "NORMAL";
  private _sound = "default";
  private _cooldownMinutes = 0;
  private _replacePrevious = false;
  private _imageUrl = "";
  private _deepLink = "";
  private _saving = false;
  private _error = "";
  private _status = "";

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has("rule") || changed.has("targets")) {
      this._initialise();
    }
  }

  private _initialise(): void {
    const key = this.rule?.id ?? "new";
    if (this._initialisedFor === key || this.targets.length === 0) return;
    this._initialisedFor = key;
    const available = supportedTargets(this.targets);
    const target = this.rule?.trigger.target
      ? available.find((item) => item.entity_id === this.rule?.trigger.target?.entity_id)
      : available.find((item) => item.available) ?? available[0];
    this._selectedTargetId = target?.entity_id ?? "";
    this._selectedSemantic = this.rule
      ? semanticFromTrigger(this.rule.trigger, target) ?? ""
      : supportedSemantics(target)[0]?.semantic ?? "";
    const duration = this.rule?.trigger.parameters.duration_seconds;
    this._durationMinutes =
      typeof duration === "number" ? Math.max(1, Math.round(duration / 60)) : 5;

    if (this.rule) {
      this._name = this.rule.name;
      this._title = this.rule.content.title;
      this._message = this.rule.content.message;
      this._contentEdited = true;
      this._imageUrl = this.rule.content.image_url ?? "";
      this._deepLink = this.rule.content.deep_link ?? "";
      this._urgency = this.rule.delivery_policy.urgency;
      this._sound = this.rule.delivery_policy.sound ?? "default";
      this._cooldownMinutes = Math.round((this.rule.behaviour.cooldown_seconds ?? 0) / 60);
      this._replacePrevious = this.rule.behaviour.replace_previous;
      this._initialiseAudience(this.rule.audiences);
      this._initialiseCondition(this.rule.conditions);
    } else {
      this._applyGeneratedContent();
    }
  }

  private _initialiseAudience(audiences: Audience[]): void {
    const single = audiences.length === 1 ? audiences[0] : undefined;
    if (single && ["ME", "EVERYONE", "ADMINS"].includes(single.type)) {
      this._audienceMode = single.type as AudienceMode;
    } else {
      this._audienceMode = "CHOOSE";
      this._recipientIds = audiences
        .filter((item) => item.type === "RECIPIENT" && item.recipient_id)
        .map((item) => item.recipient_id as string);
      this._groupIds = audiences
        .filter((item) => item.type === "GROUP" && item.group_id)
        .map((item) => item.group_id as string);
    }
  }

  private _initialiseCondition(conditions: ConditionSpec[]): void {
    const condition = conditions[0];
    if (!condition) return;
    if (["PERSON_HOME", "PERSON_AWAY"].includes(condition.type)) {
      this._conditionMode = condition.type as ConditionMode;
      this._conditionTargetId = condition.target?.entity_id ?? "";
    } else if (condition.type === "TIME_WINDOW") {
      this._conditionMode = "TIME_WINDOW";
      this._conditionStart = String(condition.parameters.start ?? "22:00");
      this._conditionEnd = String(condition.parameters.end ?? "06:00");
    }
  }

  private get _selectedTarget(): CapabilityTarget | undefined {
    return this.targets.find((item) => item.entity_id === this._selectedTargetId);
  }

  private _applyGeneratedContent(): void {
    if (this._contentEdited || !this._selectedTarget || !this._selectedSemantic) return;
    const generated = generatedMessage(
      this._selectedTarget.display_name,
      this._selectedSemantic,
      this._durationMinutes,
    );
    this._name = generated.name;
    this._title = generated.title;
    this._message = generated.message;
  }

  private _markDirty(): void {
    this._error = "";
    this._status = "";
    this.dispatchEvent(
      new CustomEvent("editor-dirty", {
        detail: { dirty: true },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _changeTarget(event: Event): void {
    this._selectedTargetId = valueFrom(event);
    this._selectedSemantic = supportedSemantics(this._selectedTarget)[0]?.semantic ?? "";
    this._contentEdited = false;
    this._applyGeneratedContent();
    this._markDirty();
  }

  private _changeSemantic(event: Event): void {
    this._selectedSemantic = valueFrom(event) as Semantic;
    this._contentEdited = false;
    this._applyGeneratedContent();
    this._markDirty();
  }

  private _changeDuration(event: Event): void {
    this._durationMinutes = Math.max(1, Number(valueFrom(event)) || 1);
    this._contentEdited = false;
    this._applyGeneratedContent();
    this._markDirty();
  }

  private _setContent(field: "name" | "title" | "message", event: Event): void {
    const value = valueFrom(event);
    if (field === "name") this._name = value;
    if (field === "title") this._title = value;
    if (field === "message") this._message = value;
    this._contentEdited = true;
    this._markDirty();
  }

  private _toggleSelection(
    collection: "recipient" | "group",
    id: string,
    checked: boolean,
  ): void {
    const current = collection === "recipient" ? this._recipientIds : this._groupIds;
    const next = checked ? [...new Set([...current, id])] : current.filter((item) => item !== id);
    if (collection === "recipient") this._recipientIds = next;
    else this._groupIds = next;
    this._markDirty();
  }

  private _audiences(): Audience[] {
    if (this._audienceMode !== "CHOOSE") {
      return [{ type: this._audienceMode, recipient_id: null, group_id: null }];
    }
    return [
      ...this._recipientIds.map((recipientId) => ({
        type: "RECIPIENT" as const,
        recipient_id: recipientId,
        group_id: null,
      })),
      ...this._groupIds.map((groupId) => ({
        type: "GROUP" as const,
        recipient_id: null,
        group_id: groupId,
      })),
    ];
  }

  private _audienceName(): string {
    if (this._audienceMode === "ME") return "me";
    if (this._audienceMode === "EVERYONE") return "Everyone";
    if (this._audienceMode === "ADMINS") return "Admins";
    const count = this._recipientIds.length + this._groupIds.length;
    return count === 1 ? "the selected person or group" : `${count} selected audiences`;
  }

  private _resolvedRecipients(): RecipientProfile[] {
    if (this._audienceMode === "ME") {
      return this.recipients.filter((item) => item.ha_user_id === this.currentUser?.id);
    }
    if (this._audienceMode === "EVERYONE") return this.recipients;
    if (this._audienceMode === "ADMINS") return [];
    const groupMembers = this.groups
      .filter((group) => this._groupIds.includes(group.id))
      .flatMap((group) => group.member_recipient_ids);
    const ids = new Set([...this._recipientIds, ...groupMembers]);
    return this.recipients.filter((recipient) => ids.has(recipient.id));
  }

  private _supports(capability: EndpointCapability): boolean {
    const recipients = this._resolvedRecipients();
    return (
      recipients.length > 0 &&
      recipients.every((recipient) =>
        recipient.endpoints.some(
          (endpoint) => endpoint.enabled && endpoint.capabilities.includes(capability),
        ),
      )
    );
  }

  private _conditions(): ConditionSpec[] {
    if (this._conditionMode === "NONE") return [];
    if (this._conditionMode === "TIME_WINDOW") {
      return [
        {
          type: "TIME_WINDOW",
          target: null,
          parameters: { start: this._conditionStart, end: this._conditionEnd },
        },
      ];
    }
    const target = this.targets.find((item) => item.entity_id === this._conditionTargetId);
    if (!target) return [];
    return [
      {
        type: this._conditionMode,
        target: {
          entity_id: target.entity_id,
          registry_id: target.registry_id,
          device_id: target.device_id,
          domain: target.domain,
          device_class: target.device_class,
          display_name_snapshot: target.display_name,
        },
        parameters: {},
      },
    ];
  }

  private async _draft(): Promise<NotificationRule> {
    if (!this.api || !this.currentUser) throw new Error("Home Assistant is unavailable.");
    const target = this._selectedTarget;
    if (!target || !this._selectedSemantic) throw new Error("Choose what should be watched.");
    const audiences = this._audiences();
    if (audiences.length === 0) throw new Error("Choose at least one person or group.");
    if (!this._name.trim() || !this._title.trim() || !this._message.trim()) {
      throw new Error("Add a notification name, title and message.");
    }
    if (
      ["PERSON_HOME", "PERSON_AWAY"].includes(this._conditionMode) &&
      !this._conditionTargetId
    ) {
      throw new Error("Choose a person for the condition.");
    }
    const parameters = this._selectedSemantic.startsWith("REMAINS_")
      ? { duration_seconds: Math.round(this._durationMinutes * 60) }
      : {};
    const trigger = await this.api.resolveTrigger(
      target.entity_id,
      this._selectedSemantic,
      parameters,
    );
    return createNotificationRule(this.currentUser, trigger, {
      id: this._draftId,
      existing: this.rule,
      name: this._name,
      audiences,
      title: this._title,
      message: this._message,
      imageUrl: this._imageUrl.trim() || null,
      deepLink: this._deepLink.trim() || null,
      conditions: this._conditions(),
      urgency: this._urgency,
      sound: this._urgency === "CRITICAL" ? this._sound.trim() || "default" : null,
      cooldownSeconds:
        this._cooldownMinutes > 0 ? Math.round(this._cooldownMinutes * 60) : null,
      replacePrevious: this._replacePrevious,
    });
  }

  private async _save(): Promise<void> {
    if (!this.api || this._saving) return;
    this._saving = true;
    this._error = "";
    try {
      const draft = await this._draft();
      const saved = this.rule
        ? await this.api.updateRule(draft, this.rule.revision)
        : await this.api.createRule(draft);
      this.dispatchEvent(
        new CustomEvent("rule-saved", { detail: { rule: saved }, bubbles: true, composed: true }),
      );
    } catch (error) {
      const apiError = normaliseApiError(error);
      this._error =
        apiError.code === "conflict"
          ? "This notification changed while you were editing it. Reload it before saving again."
          : apiError.message;
    } finally {
      this._saving = false;
    }
  }

  private async _sendTest(): Promise<void> {
    if (!this.api || this._saving) return;
    this._saving = true;
    this._error = "";
    this._status = "";
    try {
      const draft = await this._draft();
      const result = await this.api.testRule(draft);
      const sent = result.recipient_results.filter((item) => item.status === "SENT").length;
      this._status = sent
        ? `Test sent to ${sent} ${sent === 1 ? "person" : "people"}.`
        : result.reason ?? "No eligible phone could receive the test.";
    } catch (error) {
      this._error = normaliseApiError(error).message;
    } finally {
      this._saving = false;
    }
  }

  private _renderAudienceChoices() {
    const customGroups = this.groups.filter((group) => group.type === "CUSTOM");
    return html`
      <fieldset class="choice-group">
        <legend>Who should be told?</legend>
        <div class="choice-list">
          ${(this.currentUser?.is_admin
            ? (["ME", "EVERYONE", "ADMINS", "CHOOSE"] as AudienceMode[])
            : (["ME"] as AudienceMode[])
          ).map(
            (mode) => html`
              <label class="choice">
                <input
                  type="radio"
                  name="audience"
                  value=${mode}
                  .checked=${this._audienceMode === mode}
                  @change=${() => {
                    this._audienceMode = mode;
                    this._markDirty();
                  }}
                />
                ${mode === "ME"
                  ? "Me"
                  : mode === "EVERYONE"
                    ? "Everyone"
                    : mode === "ADMINS"
                      ? "Admins"
                      : "Choose people or groups"}
              </label>
            `,
          )}
        </div>
      </fieldset>
      ${this._audienceMode === "CHOOSE"
        ? html`
            <div class="expanded-choice">
              <p class="hint">People</p>
              <div class="choice-list">
                ${this.recipients.map(
                  (recipient) => html`
                    <label class="choice">
                      <input
                        type="checkbox"
                        .checked=${this._recipientIds.includes(recipient.id)}
                        @change=${(event: Event) =>
                          this._toggleSelection(
                            "recipient",
                            recipient.id,
                            (event.currentTarget as HTMLInputElement).checked,
                          )}
                      />
                      ${recipient.display_name}
                    </label>
                  `,
                )}
              </div>
              ${customGroups.length
                ? html`
                    <p class="hint">Groups</p>
                    <div class="choice-list">
                      ${customGroups.map(
                        (group) => html`
                          <label class="choice">
                            <input
                              type="checkbox"
                              .checked=${this._groupIds.includes(group.id)}
                              @change=${(event: Event) =>
                                this._toggleSelection(
                                  "group",
                                  group.id,
                                  (event.currentTarget as HTMLInputElement).checked,
                                )}
                            />
                            ${group.name}
                          </label>
                        `,
                      )}
                    </div>
                  `
                : nothing}
            </div>
          `
        : nothing}
    `;
  }

  render() {
    const targets = supportedTargets(this.targets);
    const semantics = supportedSemantics(this._selectedTarget);
    const personTargets = this.targets.filter((target) => target.category === "person");
    const showDuration = this._selectedSemantic.startsWith("REMAINS_");
    const canCritical = this._supports("critical") && this._supports("sound");
    const canImage = this._supports("image");
    const canDeepLink = this._supports("deep_link");
    const canReplace = this._supports("replacement");
    const review =
      this._selectedTarget && this._selectedSemantic
        ? reviewSentence(
            this._selectedTarget.display_name,
            this._selectedSemantic,
            this._durationMinutes,
            this._audienceName(),
          )
        : "Choose a device, event and audience to review this notification.";

    return html`
      <div class="editor-header">
        <button
          class="back"
          type="button"
          @click=${() =>
            this.dispatchEvent(new CustomEvent("editor-cancel", { bubbles: true, composed: true }))}
        >
          <ha-icon icon="mdi:arrow-left" aria-hidden="true"></ha-icon>
          Notifications
        </button>
      </div>
      <div class="page-heading">
        <h2>${this.rule ? "Edit notification" : "Create notification"}</h2>
        <p>Tell someone when something important happens at home.</p>
      </div>

      ${targets.length === 0
        ? html`
            <notification-manager-status-panel
              kind="error"
              heading="No supported devices found"
              message="Add a door, window or motion sensor in Home Assistant, then reload this page."
            ></notification-manager-status-panel>
          `
        : html`
            <section class="composer-section" aria-labelledby="what-heading">
              <div class="section-title-row">
                <span class="section-number" aria-hidden="true">1</span>
                <h3 id="what-heading">What do you want to know about?</h3>
              </div>
              <div class="field-grid">
                <div class="field full">
                  <label for="target">Door, window or motion sensor</label>
                  <select id="target" @change=${this._changeTarget} .value=${this._selectedTargetId}>
                    ${Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                      const items = targets.filter((target) => target.category === category);
                      return items.length
                        ? html`
                            <optgroup label=${label}>
                              ${items.map(
                                (target) => html`
                                  <option value=${target.entity_id} ?disabled=${!target.available}>
                                    ${target.display_name}${target.available ? "" : " (unavailable)"}
                                  </option>
                                `,
                              )}
                            </optgroup>
                          `
                        : nothing;
                    })}
                  </select>
                </div>
              </div>
            </section>

            <section class="composer-section" aria-labelledby="when-heading">
              <div class="section-title-row">
                <span class="section-number" aria-hidden="true">2</span>
                <h3 id="when-heading">When?</h3>
              </div>
              <div class="field-grid">
                <div class="field ${showDuration ? "" : "full"}">
                  <label for="semantic">When ${this._selectedTarget?.display_name ?? "it"}</label>
                  <select
                    id="semantic"
                    @change=${this._changeSemantic}
                    .value=${this._selectedSemantic}
                  >
                    ${semantics.map(
                      (choice) => html`<option value=${choice.semantic}>${choice.label}</option>`,
                    )}
                  </select>
                </div>
                ${showDuration
                  ? html`
                      <div class="field">
                        <label for="duration">For how long?</label>
                        <div>
                          <input
                            id="duration"
                            type="number"
                            min="1"
                            step="1"
                            .value=${String(this._durationMinutes)}
                            @input=${this._changeDuration}
                          />
                          <p class="hint">Minutes</p>
                        </div>
                      </div>
                    `
                  : nothing}
              </div>
            </section>

            <section class="composer-section" aria-labelledby="who-heading">
              <div class="section-title-row">
                <span class="section-number" aria-hidden="true">3</span>
                <h3 id="who-heading">Who should be told?</h3>
              </div>
              ${this._renderAudienceChoices()}
              <p class="hint">
                ${this._resolvedRecipients().length}
                ${this._resolvedRecipients().length === 1 ? "person" : "people"} currently
                resolved.
              </p>
            </section>

            <section class="composer-section" aria-labelledby="message-heading">
              <div class="section-title-row">
                <span class="section-number" aria-hidden="true">4</span>
                <h3 id="message-heading">Message</h3>
              </div>
              <div class="field-grid">
                <div class="field full">
                  <label for="name">Notification name</label>
                  <input
                    id="name"
                    .value=${this._name}
                    @input=${(event: Event) => this._setContent("name", event)}
                  />
                </div>
                <div class="field full">
                  <label for="title">Phone title</label>
                  <input
                    id="title"
                    .value=${this._title}
                    @input=${(event: Event) => this._setContent("title", event)}
                  />
                </div>
                <div class="field full">
                  <label for="message">Message</label>
                  <textarea
                    id="message"
                    .value=${this._message}
                    @input=${(event: Event) => this._setContent("message", event)}
                  ></textarea>
                </div>
              </div>
            </section>

            <section class="composer-section" aria-labelledby="options-heading">
              <details>
                <summary id="options-heading">More options</summary>
                <div class="field-grid">
                  <div class="field full">
                    <label for="condition">Only notify when</label>
                    <select
                      id="condition"
                      .value=${this._conditionMode}
                      @change=${(event: Event) => {
                        this._conditionMode = valueFrom(event) as ConditionMode;
                        this._markDirty();
                      }}
                    >
                      <option value="NONE">No additional condition</option>
                      <option value="PERSON_HOME">A selected person is home</option>
                      <option value="PERSON_AWAY">A selected person is away</option>
                      <option value="TIME_WINDOW">Between two times</option>
                    </select>
                  </div>
                  ${["PERSON_HOME", "PERSON_AWAY"].includes(this._conditionMode)
                    ? html`
                        <div class="field full">
                          <label for="condition-person">Person</label>
                          <select
                            id="condition-person"
                            .value=${this._conditionTargetId}
                            @change=${(event: Event) => {
                              this._conditionTargetId = valueFrom(event);
                              this._markDirty();
                            }}
                          >
                            <option value="">Choose a person</option>
                            ${personTargets.map(
                              (target) => html`
                                <option value=${target.entity_id}>${target.display_name}</option>
                              `,
                            )}
                          </select>
                        </div>
                      `
                    : nothing}
                  ${this._conditionMode === "TIME_WINDOW"
                    ? html`
                        <div class="field">
                          <label for="start">From</label>
                          <input
                            id="start"
                            type="time"
                            .value=${this._conditionStart}
                            @input=${(event: Event) => {
                              this._conditionStart = valueFrom(event);
                              this._markDirty();
                            }}
                          />
                        </div>
                        <div class="field">
                          <label for="end">Until</label>
                          <input
                            id="end"
                            type="time"
                            .value=${this._conditionEnd}
                            @input=${(event: Event) => {
                              this._conditionEnd = valueFrom(event);
                              this._markDirty();
                            }}
                          />
                        </div>
                      `
                    : nothing}
                  <div class="field">
                    <label for="urgency">Urgency</label>
                    <select
                      id="urgency"
                      .value=${this._urgency}
                      @change=${(event: Event) => {
                        this._urgency = valueFrom(event) as Urgency;
                        this._markDirty();
                      }}
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="IMPORTANT">Important</option>
                      <option value="CRITICAL" ?disabled=${!canCritical}>Critical</option>
                    </select>
                    ${!canCritical
                      ? html`<p class="hint">Critical alerts are not confirmed for every selected phone.</p>`
                      : nothing}
                  </div>
                  <div class="field">
                    <label for="cooldown">Wait before notifying again</label>
                    <input
                      id="cooldown"
                      type="number"
                      min="0"
                      .value=${String(this._cooldownMinutes)}
                      @input=${(event: Event) => {
                        this._cooldownMinutes = Math.max(0, Number(valueFrom(event)) || 0);
                        this._markDirty();
                      }}
                    />
                    <p class="hint">Minutes, or 0 for no cooldown</p>
                  </div>
                  ${canImage
                    ? html`
                        <div class="field full">
                          <label for="image">Image address</label>
                          <input
                            id="image"
                            inputmode="url"
                            .value=${this._imageUrl}
                            @input=${(event: Event) => {
                              this._imageUrl = valueFrom(event);
                              this._markDirty();
                            }}
                          />
                        </div>
                      `
                    : nothing}
                  ${canDeepLink
                    ? html`
                        <div class="field full">
                          <label for="deep-link">Open when tapped</label>
                          <input
                            id="deep-link"
                            .value=${this._deepLink}
                            placeholder="/lovelace/home"
                            @input=${(event: Event) => {
                              this._deepLink = valueFrom(event);
                              this._markDirty();
                            }}
                          />
                        </div>
                      `
                    : nothing}
                  ${canReplace
                    ? html`
                        <label class="choice field full">
                          <input
                            type="checkbox"
                            .checked=${this._replacePrevious}
                            @change=${(event: Event) => {
                              this._replacePrevious = (event.currentTarget as HTMLInputElement).checked;
                              this._markDirty();
                            }}
                          />
                          Replace the previous phone notification from this rule
                        </label>
                      `
                    : nothing}
                </div>
              </details>
            </section>

            <section class="composer-section" aria-labelledby="review-heading">
              <div class="section-title-row">
                <span class="section-number" aria-hidden="true">5</span>
                <h3 id="review-heading">Review</h3>
              </div>
              <p class="review">${review}</p>
              <div class="review-actions">
                <div class="feedback" aria-live="polite">
                  ${this._error ? html`<span class="error">${this._error}</span>` : this._status}
                </div>
                <div class="button-row">
                  <notification-manager-button
                    .disabled=${this._saving}
                    @click=${this._sendTest}
                  >
                    Send test
                  </notification-manager-button>
                  <notification-manager-button
                    variant="primary"
                    .disabled=${this._saving}
                    @click=${this._save}
                  >
                    ${this._saving ? "Saving…" : "Save notification"}
                  </notification-manager-button>
                </div>
              </div>
            </section>
          `}
    `;
  }
}

if (!customElements.get("notification-manager-rule-editor-page")) {
  customElements.define("notification-manager-rule-editor-page", RuleEditorPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "notification-manager-rule-editor-page": RuleEditorPage;
  }
}
