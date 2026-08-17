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
  targetInventory,
  targetReadiness,
  targetSourceKey,
} from "../rule-draft";
import { pageStyles } from "./page-styles";

type AudienceMode = "ME" | "EVERYONE" | "ADMINS" | "CHOOSE";
type ConditionMode = "PERSON_HOME" | "PERSON_AWAY" | "TIME_WINDOW" | "ENTITY_STATE";

interface ConditionDraft {
  key: string;
  mode: ConditionMode;
  targetId: string;
  start: string;
  end: string;
  expectedState: "on" | "off";
}

const SIGNAL_LABELS: Record<string, string> = {
  opening: "Door or window state",
  motion: "Motion state",
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
    _conditionDrafts: { state: true },
    _durationMinutes: { state: true },
    _error: { state: true },
    _groupIds: { state: true },
    _name: { state: true },
    _recipientIds: { state: true },
    _saving: { state: true },
    _sourcePickerOpen: { state: true },
    _sourceSearch: { state: true },
    _selectedSemantic: { state: true },
    _selectedSourceKey: { state: true },
    _selectedTargetId: { state: true },
    _status: { state: true },
    _title: { state: true },
    _message: { state: true },
  };

  static styles = [
    pageStyles,
    css`
      :host {
        max-inline-size: 1040px;
        margin-inline: auto;
      }

      .editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--nm-space-4);
        margin-bottom: var(--nm-space-2);
      }

      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible,
      summary:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .composer-section {
        border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-block: var(--nm-space-4);
      }

      .editor-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px;
        align-items: start;
        gap: var(--nm-space-6);
      }

      .editor-form {
        min-inline-size: 0;
      }

      .editor-form .composer-section:first-child {
        border-top: 0;
        padding-block-start: 0;
      }

      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--nm-space-4);
        margin-top: var(--nm-space-4);
      }

      .field,
      .choice-group {
        display: grid;
        gap: var(--nm-space-2);
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

      input:not([type="checkbox"]):not([type="radio"]),
      select,
      textarea {
        inline-size: 100%;
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

      .source-search {
        margin-top: var(--nm-space-4);
      }

      .source-list,
      .signal-list,
      .behaviour-list {
        display: grid;
        gap: var(--nm-space-2);
        margin-top: var(--nm-space-3);
      }

      .source-list {
        max-block-size: 320px;
        overflow-y: auto;
        padding-inline-end: var(--nm-space-1);
        scrollbar-gutter: stable;
      }

      .source-option,
      .signal-option,
      .behaviour-option {
        inline-size: 100%;
        min-block-size: var(--nm-option-height);
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--nm-space-3);
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
        border-radius: var(--nm-radius);
        padding: var(--nm-space-2) var(--nm-space-3);
        background: var(--card-background-color, #fafafa);
        color: var(--primary-text-color, #212121);
        text-align: start;
        font: inherit;
        cursor: pointer;
      }

      .behaviour-option {
        grid-template-columns: minmax(0, 1fr);
      }

      .source-summary {
        margin-top: var(--nm-space-3);
      }

      .change-label {
        color: var(--primary-color, #3f6f58);
        font-weight: 600;
      }

      .source-option:hover,
      .signal-option:hover,
      .behaviour-option:hover {
        border-color: var(--primary-color, #3f6f58);
      }

      .source-option[aria-pressed="true"],
      .signal-option[aria-pressed="true"],
      .behaviour-option[aria-pressed="true"] {
        border-color: var(--primary-color, #3f6f58);
        background: color-mix(in srgb, var(--primary-color, #3f6f58) 8%, transparent);
      }

      .source-option:focus-visible,
      .signal-option:focus-visible,
      .behaviour-option:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      .signal-option:disabled {
        cursor: not-allowed;
        opacity: 0.62;
      }

      .source-option:disabled {
        cursor: not-allowed;
        opacity: 0.62;
      }

      .option-copy {
        display: grid;
        gap: 2px;
        min-inline-size: 0;
      }

      .option-title {
        overflow-wrap: anywhere;
        font-weight: 600;
      }

      .option-meta,
      .option-count {
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
        font-weight: 400;
      }

      .selection-path {
        margin: 8px 0 0;
        color: var(--secondary-text-color, #616161);
        font-size: 14px;
      }

      .no-results {
        margin: 12px 0 0;
        color: var(--secondary-text-color, #616161);
      }

      .condition-list {
        display: grid;
        grid-column: 1 / -1;
        gap: var(--nm-space-3);
      }

      .condition-card {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--nm-space-3);
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
        border-radius: var(--nm-radius);
        padding: var(--nm-space-3);
      }

      .condition-card .condition-kind,
      .condition-card .condition-target {
        grid-column: 1 / -1;
      }

      .condition-actions {
        grid-column: 1 / -1;
        text-align: end;
      }

      .condition-actions button,
      .add-condition {
        min-block-size: var(--nm-control-height);
        border: 0;
        border-radius: var(--nm-radius-compact);
        padding: 0 var(--nm-space-3);
        background: transparent;
        color: var(--primary-color, #3f6f58);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .condition-actions button:focus-visible,
      .add-condition:focus-visible {
        outline: 2px solid var(--primary-color, #3f6f58);
        outline-offset: 2px;
      }

      fieldset {
        min-inline-size: 0;
        margin: var(--nm-space-4) 0 0;
        border: 0;
        padding: 0;
      }

      .choice-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--nm-space-2);
        margin-top: var(--nm-space-2);
      }

      .choice {
        display: flex;
        align-items: flex-start;
        gap: var(--nm-space-2);
        min-block-size: var(--nm-control-height);
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.35));
        border-radius: var(--nm-radius-compact);
        padding: var(--nm-space-2);
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
        margin-top: var(--nm-space-3);
        border-inline-start: 3px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-inline-start: var(--nm-space-4);
      }

      details {
        border-block: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        padding-block: 4px;
      }

      summary {
        min-block-size: var(--nm-option-height);
        display: flex;
        align-items: center;
        font-weight: 600;
        cursor: pointer;
      }

      .review {
        margin: 10px 0 0;
        color: var(--primary-text-color, #212121);
        font-size: 15px;
        line-height: 1.5;
      }

      .review-panel {
        position: sticky;
        inset-block-start: 24px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        border-radius: var(--nm-radius);
        padding: var(--nm-space-4);
        background: var(--card-background-color, #fafafa);
      }

      .review-actions {
        display: grid;
        align-items: stretch;
        justify-content: stretch;
        gap: var(--nm-space-4);
        margin-top: var(--nm-space-4);
      }

      .button-row {
        display: grid;
        justify-content: stretch;
        gap: var(--nm-space-2);
      }

      .mobile-actions {
        display: none;
      }

      .mobile-feedback {
        grid-column: 1 / -1;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
      }

      .feedback {
        min-block-size: 22px;
        color: var(--secondary-text-color, #616161);
        font-size: 13px;
      }

      .error {
        color: var(--error-color, #c62828);
      }

      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      @media (max-width: 840px) {
        :host { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
        .editor-layout { grid-template-columns: 1fr; gap: var(--nm-space-2); }
        .review-panel { position: static; }

        .review-panel .review-actions {
          display: none;
        }

        .mobile-actions {
          position: fixed;
          z-index: 5;
          inset-inline: 0;
          inset-block-end: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: var(--nm-space-2);
          border-top: 1px solid var(--nm-border);
          padding:
            var(--nm-space-3)
            max(var(--nm-space-4), env(safe-area-inset-right))
            max(var(--nm-space-3), env(safe-area-inset-bottom))
            max(var(--nm-space-4), env(safe-area-inset-left));
          background: var(--card-background-color, #fafafa);
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
        }
      }

      @media (max-width: 640px) {
        .field-grid,
        .choice-list,
        .condition-card {
          grid-template-columns: 1fr;
        }

        .choice-list { gap: var(--nm-space-2); }
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
  private _selectedSourceKey = "";
  private _selectedTargetId = "";
  private _selectedSemantic: Semantic | "" = "";
  private _sourcePickerOpen = true;
  private _sourceSearch = "";
  private _durationMinutes = 5;
  private _audienceMode: AudienceMode = "ME";
  private _recipientIds: string[] = [];
  private _groupIds: string[] = [];
  private _name = "";
  private _title = "";
  private _message = "";
  private _contentEdited = false;
  private _conditionDrafts: ConditionDraft[] = [];
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
    this._sourcePickerOpen = !this.rule;
    this._sourceSearch = "";
    const inventory = targetInventory(this.targets);
    const target = this.rule?.trigger.target
      ? inventory.discoveredTargets.find(
          (item) => item.entity_id === this.rule?.trigger.target?.entity_id,
        )
      : inventory.usableTargets[0];
    this._selectedSourceKey = target ? targetSourceKey(target) : "";
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
      this._initialiseConditions(this.rule.conditions);
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

  private _initialiseConditions(conditions: ConditionSpec[]): void {
    this._conditionDrafts = conditions.map((condition) => ({
      key: newRuleId(),
      mode: condition.type,
      targetId: condition.target?.entity_id ?? "",
      start: String(condition.parameters.start ?? "22:00"),
      end: String(condition.parameters.end ?? "06:00"),
      expectedState: condition.parameters.state === "off" ? "off" : "on",
    }));
  }

  private _addCondition(): void {
    this._conditionDrafts = [
      ...this._conditionDrafts,
      {
        key: newRuleId(),
        mode: "PERSON_HOME",
        targetId: "",
        start: "22:00",
        end: "06:00",
        expectedState: "on",
      },
    ];
    this._markDirty();
  }

  private _updateCondition(index: number, values: Partial<ConditionDraft>): void {
    this._conditionDrafts = this._conditionDrafts.map((condition, conditionIndex) =>
      conditionIndex === index ? { ...condition, ...values } : condition,
    );
    this._markDirty();
  }

  private _removeCondition(index: number): void {
    this._conditionDrafts = this._conditionDrafts.filter(
      (_condition, conditionIndex) => conditionIndex !== index,
    );
    this._markDirty();
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

  private _selectSource(sourceKey: string): void {
    const source = targetInventory(this.targets).sources.find(
      (item) => item.key === sourceKey,
    );
    if (!source) return;
    const target = source.targets.find((item) => targetReadiness(item) === "ready");
    if (!target) return;
    this._selectedSourceKey = source.key;
    this._sourcePickerOpen = false;
    this._sourceSearch = "";
    this._selectTarget(target.entity_id);
  }

  private _selectTarget(targetId: string): void {
    this._sourcePickerOpen = false;
    this._sourceSearch = "";
    if (targetId === this._selectedTargetId) return;
    this._selectedTargetId = targetId;
    this._selectedSemantic = supportedSemantics(this._selectedTarget)[0]?.semantic ?? "";
    this._contentEdited = false;
    this._applyGeneratedContent();
    this._markDirty();
  }

  private _selectSemantic(semantic: Semantic): void {
    if (semantic === this._selectedSemantic) return;
    this._selectedSemantic = semantic;
    this._contentEdited = false;
    this._applyGeneratedContent();
    this._markDirty();
  }

  private _changeSourceSearch(event: Event): void {
    this._sourceSearch = valueFrom(event);
  }

  private async _openSourcePicker(): Promise<void> {
    this._sourcePickerOpen = true;
    await this.updateComplete;
    this.shadowRoot?.querySelector<HTMLInputElement>("#source-search")?.focus();
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
    return this._conditionDrafts.flatMap((condition): ConditionSpec[] => {
      if (condition.mode === "TIME_WINDOW") {
        return [
          {
            type: "TIME_WINDOW",
            target: null,
            parameters: { start: condition.start, end: condition.end },
          },
        ];
      }
      const target = this.targets.find((item) => item.entity_id === condition.targetId);
      if (!target) return [];
      return [
        {
          type: condition.mode,
          target: {
            entity_id: target.entity_id,
            registry_id: target.registry_id,
            device_id: target.device_id,
            domain: target.domain,
            device_class: target.device_class,
            display_name_snapshot: target.display_name,
          },
          parameters:
            condition.mode === "ENTITY_STATE"
              ? { state: condition.expectedState }
              : {},
        },
      ];
    });
  }

  private async _draft(): Promise<NotificationRule> {
    if (!this.api || !this.currentUser) throw new Error("Home Assistant is unavailable.");
    const target = this._selectedTarget;
    if (!target || !this._selectedSemantic || targetReadiness(target) !== "ready") {
      throw new Error("Choose an available notification-ready signal.");
    }
    const audiences = this._audiences();
    if (audiences.length === 0) throw new Error("Choose at least one person or group.");
    if (!this._name.trim() || !this._title.trim() || !this._message.trim()) {
      throw new Error("Add a notification name, title and message.");
    }
    for (const condition of this._conditionDrafts) {
      if (condition.mode !== "TIME_WINDOW" && !condition.targetId) {
        throw new Error(
          condition.mode === "ENTITY_STATE"
            ? "Choose a device for each condition."
            : "Choose a person for each condition.",
        );
      }
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
        <legend class="sr-only">Recipients</legend>
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
    const inventory = targetInventory(this.targets);
    const { sources, usableTargets: readyTargets } = inventory;
    const selectedSource = sources.find((source) => source.key === this._selectedSourceKey);
    const query = this._sourceSearch.trim().toLocaleLowerCase();
    const visibleSources = query
      ? sources.filter(
          (source) =>
            source.name.toLocaleLowerCase().includes(query) ||
            source.targets.some(
              (target) =>
                target.display_name.toLocaleLowerCase().includes(query) ||
                target.entity_id.toLocaleLowerCase().includes(query),
            ),
        )
      : sources;
    const selectedTargetReady =
      this._selectedTarget && targetReadiness(this._selectedTarget) === "ready";
    const semantics = selectedTargetReady ? supportedSemantics(this._selectedTarget) : [];
    const personTargets = this.targets.filter((target) => target.category === "person");
    const showDuration = this._selectedSemantic.startsWith("REMAINS_");
    const canImportant = this._supports("important");
    const canCritical = this._supports("critical") && this._supports("sound");
    const canImage = this._supports("image");
    const canDeepLink = this._supports("deep_link");
    const canReplace = this._supports("replacement");
    const resolvedRecipients = this._resolvedRecipients();
    const resolvedPhones = resolvedRecipients.filter((recipient) =>
      recipient.endpoints.some((endpoint) => endpoint.enabled),
    ).length;
    const review =
      this._selectedTarget && this._selectedSemantic
        ? reviewSentence(
            this._selectedTarget.display_name,
            this._selectedSemantic,
            this._durationMinutes,
            this._audienceName(),
          )
        : "Choose a device, signal, behaviour and audience to review this notification.";

    return html`
      <div class="editor-header">
        <notification-manager-button
          variant="quiet"
          icon="mdi:arrow-left"
          @click=${() =>
            this.dispatchEvent(new CustomEvent("editor-cancel", { bubbles: true, composed: true }))}
        >
          Notifications
        </notification-manager-button>
      </div>
      <div class="page-heading">
        <h2>${this.rule ? "Edit notification" : "Create notification"}</h2>
        <p>Choose what to monitor, what should happen and who should be notified.</p>
      </div>

      ${readyTargets.length === 0
        ? html`
            <notification-manager-status-panel
              kind="error"
              heading="No notification-ready signals found"
              message="Add a supported device or entity in Home Assistant, then reload this page."
            ></notification-manager-status-panel>
          `
        : html`
            <div class="editor-layout">
              <div class="editor-form">
            <section class="composer-section" aria-labelledby="what-heading">
              <h3 id="what-heading">Device</h3>
              ${this._sourcePickerOpen
                ? html`
                    <div class="field source-search">
                      <label for="source-search">Find a device or entity</label>
                      <input
                        id="source-search"
                        type="search"
                        placeholder="Search by device, signal or entity ID"
                        autocomplete="off"
                        .value=${this._sourceSearch}
                        @input=${this._changeSourceSearch}
                      />
                    </div>
                    <div class="source-list" aria-label="Devices and entities">
                      ${visibleSources.map(
                        (source) => html`
                          <button
                            class="source-option"
                            type="button"
                            aria-pressed=${source.key === this._selectedSourceKey ? "true" : "false"}
                            ?disabled=${source.targets.every(
                              (target) => targetReadiness(target) !== "ready",
                            )}
                            @click=${() => this._selectSource(source.key)}
                          >
                            <span class="option-copy">
                              <span class="option-title">${source.name}</span>
                               <span class="option-meta">
                                 ${source.kind === "device" ? "Device" : "Individual entity"}${
                                   source.targets.every((target) => targetReadiness(target) !== "ready")
                                     ? " · No notification-ready signals"
                                     : ""
                                 }
                              </span>
                            </span>
                            <span class="option-count">
                              ${source.targets.filter((target) => targetReadiness(target) === "ready").length}
                              of ${source.targets.length} ready
                            </span>
                          </button>
                        `,
                      )}
                    </div>
                    ${visibleSources.length === 0
                      ? html`<p class="no-results">No matching devices or entities.</p>`
                      : nothing}
                  `
                : html`
                    <button
                      class="source-option source-summary"
                      type="button"
                      @click=${this._openSourcePicker}
                    >
                      <span class="option-copy">
                        <span class="option-title">${selectedSource?.name ?? "Selected entity"}</span>
                        <span class="option-meta">
                          ${selectedSource?.kind === "device" ? "Device" : "Individual entity"}
                        </span>
                      </span>
                      <span class="change-label">Change</span>
                    </button>
                  `}
            </section>

            <section class="composer-section" aria-labelledby="signal-heading">
              <h3 id="signal-heading">Signal</h3>
              <p class="selection-path">
                Choose what on ${selectedSource?.name ?? "this device"} should be monitored.
              </p>
              <div class="signal-list" aria-label="Signals">
                ${selectedSource?.targets.map(
                  (target) => html`
                    <button
                      class="signal-option"
                       type="button"
                       aria-pressed=${target.entity_id === this._selectedTargetId ? "true" : "false"}
                       ?disabled=${targetReadiness(target) !== "ready"}
                      @click=${() => this._selectTarget(target.entity_id)}
                    >
                      <span class="option-copy">
                        <span class="option-title">${target.display_name}</span>
                        <span class="option-meta">
                           ${SIGNAL_LABELS[target.category] ?? "Entity state"}${
                             targetReadiness(target) === "unavailable"
                               ? " · Unavailable"
                               : targetReadiness(target) === "unsupported"
                                 ? " · Not supported for notifications yet"
                                 : ""
                           }
                        </span>
                      </span>
                    </button>
                  `,
                )}
              </div>
            </section>

            <section class="composer-section" aria-labelledby="when-heading">
              <h3 id="when-heading">Behaviour</h3>
              <p class="selection-path">When ${this._selectedTarget?.display_name ?? "the signal"}…</p>
              <div class="behaviour-list" aria-label="Behaviours">
                ${semantics.map(
                  (choice) => html`
                    <button
                      class="behaviour-option"
                      type="button"
                      aria-pressed=${choice.semantic === this._selectedSemantic ? "true" : "false"}
                      @click=${() => this._selectSemantic(choice.semantic)}
                    >
                      <span class="option-title">${choice.label}</span>
                    </button>
                  `,
                )}
              </div>
              <div class="field-grid">
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
              <h3 id="who-heading">Recipients</h3>
              ${this._renderAudienceChoices()}
              <p class="hint">
                ${resolvedRecipients.length}
                ${resolvedRecipients.length === 1 ? "person" : "people"},
                ${resolvedPhones} ${resolvedPhones === 1 ? "phone" : "phones"} currently ready
              </p>
            </section>

            <section class="composer-section" aria-labelledby="message-heading">
              <h3 id="message-heading">Message</h3>
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
                <summary id="options-heading">Conditions and delivery options</summary>
                <div class="field-grid">
                  <div class="field full">
                    <label>Only notify when</label>
                    ${this._conditionDrafts.length === 0
                      ? html`<p class="hint">No additional conditions</p>`
                      : nothing}
                  </div>
                  <div class="condition-list">
                    ${this._conditionDrafts.map((condition, index) => {
                      const conditionTarget = this.targets.find(
                        (target) => target.entity_id === condition.targetId,
                      );
                      const conditionTargets =
                        condition.mode === "ENTITY_STATE"
                          ? this.targets.filter((target) =>
                              ["opening", "motion"].includes(target.category),
                            )
                          : personTargets;
                      const activeLabel =
                        conditionTarget?.category === "motion" ? "Activity detected" : "Open";
                      const inactiveLabel =
                        conditionTarget?.category === "motion" ? "Clear" : "Closed";
                      return html`
                        <div class="condition-card">
                          <div class="field condition-kind">
                            <label for=${`condition-kind-${condition.key}`}>Condition</label>
                            <select
                              id=${`condition-kind-${condition.key}`}
                              .value=${condition.mode}
                              @change=${(event: Event) =>
                                this._updateCondition(index, {
                                  mode: valueFrom(event) as ConditionMode,
                                  targetId: "",
                                })}
                            >
                              <option value="PERSON_HOME">A selected person is home</option>
                              <option value="PERSON_AWAY">A selected person is away</option>
                              <option value="TIME_WINDOW">Between two times</option>
                              <option value="ENTITY_STATE">Another device is in a selected state</option>
                            </select>
                          </div>
                          ${condition.mode === "TIME_WINDOW"
                            ? html`
                                <div class="field">
                                  <label for=${`condition-start-${condition.key}`}>From</label>
                                  <input
                                    id=${`condition-start-${condition.key}`}
                                    type="time"
                                    .value=${condition.start}
                                    @input=${(event: Event) =>
                                      this._updateCondition(index, { start: valueFrom(event) })}
                                  />
                                </div>
                                <div class="field">
                                  <label for=${`condition-end-${condition.key}`}>Until</label>
                                  <input
                                    id=${`condition-end-${condition.key}`}
                                    type="time"
                                    .value=${condition.end}
                                    @input=${(event: Event) =>
                                      this._updateCondition(index, { end: valueFrom(event) })}
                                  />
                                </div>
                              `
                            : html`
                                <div class="field condition-target">
                                  <label for=${`condition-target-${condition.key}`}>
                                    ${condition.mode === "ENTITY_STATE" ? "Device" : "Person"}
                                  </label>
                                  <select
                                    id=${`condition-target-${condition.key}`}
                                    .value=${condition.targetId}
                                    @change=${(event: Event) =>
                                      this._updateCondition(index, {
                                        targetId: valueFrom(event),
                                      })}
                                  >
                                    <option value="">
                                      ${condition.mode === "ENTITY_STATE"
                                        ? "Choose a device"
                                        : "Choose a person"}
                                    </option>
                                    ${conditionTargets.map(
                                      (target) => html`
                                        <option value=${target.entity_id} ?disabled=${!target.available}>
                                          ${target.display_name}
                                        </option>
                                      `,
                                    )}
                                  </select>
                                </div>
                                ${condition.mode === "ENTITY_STATE"
                                  ? html`
                                      <div class="field condition-target">
                                        <label for=${`condition-state-${condition.key}`}>State</label>
                                        <select
                                          id=${`condition-state-${condition.key}`}
                                          .value=${condition.expectedState}
                                          @change=${(event: Event) =>
                                            this._updateCondition(index, {
                                              expectedState: valueFrom(event) as "on" | "off",
                                            })}
                                        >
                                          <option value="on">${activeLabel}</option>
                                          <option value="off">${inactiveLabel}</option>
                                        </select>
                                      </div>
                                    `
                                  : nothing}
                              `}
                          <div class="condition-actions">
                            <button type="button" @click=${() => this._removeCondition(index)}>
                              Remove condition
                            </button>
                          </div>
                        </div>
                      `;
                    })}
                  </div>
                  <div class="field full">
                    <button class="add-condition" type="button" @click=${this._addCondition}>
                      + Add condition
                    </button>
                    ${this._conditionDrafts.length > 1
                      ? html`<p class="hint">All conditions must be met.</p>`
                      : nothing}
                  </div>
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
                      <option value="IMPORTANT" ?disabled=${!canImportant}>Important</option>
                      <option value="CRITICAL" ?disabled=${!canCritical}>Critical</option>
                    </select>
                    ${!canImportant
                      ? html`<p class="hint">Important alerts are not confirmed for every selected phone.</p>`
                      : nothing}
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
              </div>

            <aside class="review-panel" aria-labelledby="review-heading">
              <h3 id="review-heading">Review</h3>
              <p class="review">${review}</p>
              <div class="review-actions">
                <div class="feedback" aria-live="polite">
                  ${this._error ? html`<span class="error">${this._error}</span>` : this._status}
                </div>
                <div class="button-row">
                  <notification-manager-button
                    .fullWidth=${true}
                    .disabled=${this._saving}
                    @click=${this._sendTest}
                  >
                    Send test
                  </notification-manager-button>
                  <notification-manager-button
                    variant="primary"
                    .fullWidth=${true}
                    .disabled=${this._saving}
                    @click=${this._save}
                  >
                    ${this._saving ? "Saving…" : "Save notification"}
                  </notification-manager-button>
                </div>
              </div>
            </aside>
            </div>
            <div class="mobile-actions" aria-label="Notification actions">
              ${this._error || this._status
                ? html`
                    <div class="mobile-feedback" aria-live="polite">
                      ${this._error ? html`<span class="error">${this._error}</span>` : this._status}
                    </div>
                  `
                : nothing}
              <notification-manager-button
                .fullWidth=${true}
                .disabled=${this._saving}
                @click=${this._sendTest}
              >
                Send test
              </notification-manager-button>
              <notification-manager-button
                variant="primary"
                .fullWidth=${true}
                .disabled=${this._saving}
                @click=${this._save}
              >
                ${this._saving ? "Saving…" : "Save notification"}
              </notification-manager-button>
            </div>
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
