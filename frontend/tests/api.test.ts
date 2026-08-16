import { describe, expect, it } from "vitest";

import {
  COMMANDS,
  NotificationManagerApi,
} from "../src/api";
import type { HomeAssistantWebSocketClient, WebSocketMessage } from "../src/ha";
import type { NotificationRule, RecipientGroup, RecipientProfile } from "../src/models";

class RecordingConnection implements HomeAssistantWebSocketClient {
  readonly calls: WebSocketMessage[] = [];
  result: unknown = undefined;
  failure: unknown = undefined;

  async callWS<T>(message: WebSocketMessage): Promise<T> {
    this.calls.push(message);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return this.result as T;
  }
}

const rule = { id: "rule-1", revision: 4 } as NotificationRule;
const recipient = { id: "recipient-1" } as RecipientProfile;
const group = { id: "group-1" } as RecipientGroup;

describe("NotificationManagerApi", () => {
  it("uses the stable command names and request fields", async () => {
    const connection = new RecordingConnection();
    const api = new NotificationManagerApi(connection);

    await api.bootstrap();
    await api.listRules();
    await api.getRule("rule-1");
    await api.createRule(rule);
    await api.updateRule(rule, 4);
    await api.deleteRule("rule-1", 4);
    await api.setRuleEnabled("rule-1", true, 4);
    await api.listRecipients();
    await api.updateRecipient(recipient);
    await api.testRecipient("recipient-1");
    await api.listGroups();
    await api.createGroup(group);
    await api.updateGroup(group);
    await api.deleteGroup("group-1");
    await api.listCapabilityTargets();
    await api.getCapabilitiesForTarget("binary_sensor.front_door");

    expect(connection.calls).toEqual([
      { type: COMMANDS.bootstrap },
      { type: COMMANDS.rulesList },
      { type: COMMANDS.rulesGet, rule_id: "rule-1" },
      { type: COMMANDS.rulesCreate, rule },
      { type: COMMANDS.rulesUpdate, rule, expected_revision: 4 },
      { type: COMMANDS.rulesDelete, rule_id: "rule-1", expected_revision: 4 },
      {
        type: COMMANDS.rulesSetEnabled,
        rule_id: "rule-1",
        enabled: true,
        expected_revision: 4,
      },
      { type: COMMANDS.recipientsList },
      { type: COMMANDS.recipientsUpdate, recipient },
      { type: COMMANDS.recipientsTest, recipient_id: "recipient-1" },
      { type: COMMANDS.groupsList },
      { type: COMMANDS.groupsCreate, group },
      { type: COMMANDS.groupsUpdate, group },
      { type: COMMANDS.groupsDelete, group_id: "group-1" },
      { type: COMMANDS.capabilityTargets },
      {
        type: COMMANDS.capabilityForTarget,
        entity_id: "binary_sensor.front_door",
      },
    ]);
  });

  it("preserves Home Assistant error codes and messages", async () => {
    const connection = new RecordingConnection();
    connection.failure = {
      code: "permission_denied",
      message: "You cannot update this notification.",
      error: { rule_id: "rule-1" },
    };
    const api = new NotificationManagerApi(connection);

    await expect(api.getRule("rule-1")).rejects.toMatchObject({
      name: "NotificationManagerApiError",
      code: "permission_denied",
      message: "You cannot update this notification.",
      details: { rule_id: "rule-1" },
    });
  });
});
