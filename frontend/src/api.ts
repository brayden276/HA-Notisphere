import type { HomeAssistantWebSocketClient, WebSocketMessage } from "./ha";
import type {
  BootstrapData,
  CapabilityTarget,
  NotificationRule,
  RecipientGroup,
  RecipientProfile,
  RecipientResult,
} from "./models";

export const COMMANDS = {
  bootstrap: "notification_manager/bootstrap",
  rulesList: "notification_manager/rules/list",
  rulesGet: "notification_manager/rules/get",
  rulesCreate: "notification_manager/rules/create",
  rulesUpdate: "notification_manager/rules/update",
  rulesDelete: "notification_manager/rules/delete",
  rulesSetEnabled: "notification_manager/rules/set_enabled",
  recipientsList: "notification_manager/recipients/list",
  recipientsUpdate: "notification_manager/recipients/update",
  recipientsTest: "notification_manager/recipients/test",
  groupsList: "notification_manager/groups/list",
  groupsCreate: "notification_manager/groups/create",
  groupsUpdate: "notification_manager/groups/update",
  groupsDelete: "notification_manager/groups/delete",
  capabilityTargets: "notification_manager/capabilities/targets",
  capabilityForTarget: "notification_manager/capabilities/for_target",
} as const;

export class NotificationManagerApiError extends Error {
  readonly code: string;
  readonly details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "NotificationManagerApiError";
    this.code = code;
    this.details = details;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normaliseApiError(error: unknown): NotificationManagerApiError {
  if (error instanceof NotificationManagerApiError) {
    return error;
  }
  if (isObject(error)) {
    const code = typeof error.code === "string" ? error.code : "unknown_error";
    const message =
      typeof error.message === "string" && error.message.trim().length > 0
        ? error.message
        : "Notification Manager could not complete the request.";
    return new NotificationManagerApiError(code, message, error.error);
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return new NotificationManagerApiError("unknown_error", error.message);
  }
  return new NotificationManagerApiError(
    "unknown_error",
    "Notification Manager could not complete the request.",
  );
}

export class NotificationManagerApi {
  constructor(private readonly client: HomeAssistantWebSocketClient) {}

  private async call<T>(message: WebSocketMessage): Promise<T> {
    try {
      return await this.client.callWS<T>(message);
    } catch (error) {
      throw normaliseApiError(error);
    }
  }

  bootstrap(): Promise<BootstrapData> {
    return this.call({ type: COMMANDS.bootstrap });
  }

  listRules(): Promise<NotificationRule[]> {
    return this.call({ type: COMMANDS.rulesList });
  }

  getRule(ruleId: string): Promise<NotificationRule> {
    return this.call({ type: COMMANDS.rulesGet, rule_id: ruleId });
  }

  createRule(rule: NotificationRule): Promise<NotificationRule> {
    return this.call({ type: COMMANDS.rulesCreate, rule });
  }

  updateRule(rule: NotificationRule, expectedRevision: number): Promise<NotificationRule> {
    return this.call({
      type: COMMANDS.rulesUpdate,
      rule,
      expected_revision: expectedRevision,
    });
  }

  deleteRule(ruleId: string, expectedRevision: number): Promise<void> {
    return this.call({
      type: COMMANDS.rulesDelete,
      rule_id: ruleId,
      expected_revision: expectedRevision,
    });
  }

  setRuleEnabled(
    ruleId: string,
    enabled: boolean,
    expectedRevision: number,
  ): Promise<NotificationRule> {
    return this.call({
      type: COMMANDS.rulesSetEnabled,
      rule_id: ruleId,
      enabled,
      expected_revision: expectedRevision,
    });
  }

  listRecipients(): Promise<RecipientProfile[]> {
    return this.call({ type: COMMANDS.recipientsList });
  }

  updateRecipient(recipient: RecipientProfile): Promise<RecipientProfile> {
    return this.call({ type: COMMANDS.recipientsUpdate, recipient });
  }

  testRecipient(recipientId: string): Promise<RecipientResult> {
    return this.call({
      type: COMMANDS.recipientsTest,
      recipient_id: recipientId,
    });
  }

  listGroups(): Promise<RecipientGroup[]> {
    return this.call({ type: COMMANDS.groupsList });
  }

  createGroup(group: RecipientGroup): Promise<RecipientGroup> {
    return this.call({ type: COMMANDS.groupsCreate, group });
  }

  updateGroup(group: RecipientGroup): Promise<RecipientGroup> {
    return this.call({ type: COMMANDS.groupsUpdate, group });
  }

  deleteGroup(groupId: string): Promise<void> {
    return this.call({ type: COMMANDS.groupsDelete, group_id: groupId });
  }

  listCapabilityTargets(): Promise<CapabilityTarget[]> {
    return this.call({ type: COMMANDS.capabilityTargets });
  }

  getCapabilitiesForTarget(entityId: string): Promise<CapabilityTarget> {
    return this.call({
      type: COMMANDS.capabilityForTarget,
      entity_id: entityId,
    });
  }
}
