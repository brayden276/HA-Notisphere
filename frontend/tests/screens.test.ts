// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import type { NotificationManagerApi } from "../src/api";
import type {
  CapabilityTarget,
  CurrentUser,
  NotificationRule,
  RecipientProfile,
  ResolvedTrigger,
} from "../src/models";
import "../src/pages/notifications-page";
import "../src/pages/rule-editor-page";
import type { NotificationsPage } from "../src/pages/notifications-page";
import type { RuleEditorPage } from "../src/pages/rule-editor-page";

const user: CurrentUser = { id: "user-1", name: "Alice", is_admin: true };
const garage: CapabilityTarget = {
  entity_id: "binary_sensor.garage_door",
  display_name: "Garage Door",
  domain: "binary_sensor",
  device_class: "garage_door",
  category: "opening",
  available: true,
  registry_id: "registry-garage",
  device_id: "device-garage",
  device_name: "Garage",
  unit: null,
  synthetic: false,
  semantics: [
    { semantic: "OPENED", label: "Opens", parameters: [] },
    {
      semantic: "REMAINS_OPEN",
      label: "Stays open",
      parameters: [
        {
          key: "duration_seconds",
          type: "integer",
          label: "For",
          required: true,
          unit: "seconds",
          minimum: 1,
        },
      ],
    },
  ],
};
const recipient: RecipientProfile = {
  id: "recipient-1",
  ha_user_id: "user-1",
  person_entity_id: "person.alice",
  display_name: "Alice",
  endpoints: [
    {
      id: "phone-1",
      type: "HA_NOTIFY",
      target: "notify.mobile_app_alice",
      platform: "mobile_app",
      capabilities: ["title", "image", "deep_link", "replacement"],
      enabled: true,
      priority: 0,
    },
  ],
  preferences: { preferred_endpoint_id: "phone-1", allow_critical: true },
};
const trigger: ResolvedTrigger = {
  type: "BINARY_STATE_DURATION",
  target: {
    entity_id: garage.entity_id,
    registry_id: garage.registry_id,
    device_id: garage.device_id,
    domain: garage.domain,
    device_class: garage.device_class,
    display_name_snapshot: garage.display_name,
  },
  parameters: { state: "on", duration_seconds: 300 },
};
const rule: NotificationRule = {
  id: "rule-1",
  revision: 1,
  schema_version: 1,
  name: "Garage Door left open",
  enabled: true,
  owner_user_id: user.id,
  scope: "HOUSEHOLD",
  trigger,
  conditions: [],
  audiences: [{ type: "EVERYONE", recipient_id: null, group_id: null }],
  content: {
    title: "Garage Door",
    message: "The garage door has been open for 5 minutes.",
    image_url: null,
    deep_link: null,
    actions: [],
  },
  delivery_policy: { urgency: "NORMAL", deduplicate_endpoints: true, sound: null },
  behaviour: {
    cooldown_seconds: null,
    reminder_after_seconds: null,
    repeat_every_seconds: null,
    max_repeats: null,
    stop_when_resolved: false,
    replace_previous: false,
  },
  health: { status: "HEALTHY", issues: [] },
  created_at: "2026-08-16T00:00:00Z",
  updated_at: "2026-08-16T00:00:00Z",
};

async function settle(element: { updateComplete: Promise<boolean> }): Promise<void> {
  await element.updateComplete;
  await Promise.resolve();
  await element.updateComplete;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("core product screens", () => {
  it("renders the actionable empty state and a human broken-rule state", async () => {
    const page = document.createElement(
      "notification-manager-notifications-page",
    ) as NotificationsPage;
    page.currentUser = user;
    page.targets = [garage];
    document.body.append(page);
    await settle(page);

    const empty = page.shadowRoot?.querySelector(
      "notification-manager-empty-state",
    ) as HTMLElement & { heading: string };
    expect(empty.heading).toBe("No notifications yet");
    expect(page.shadowRoot?.textContent).toContain("Create notification");

    page.rules = [
      {
        ...rule,
        health: {
          status: "NEEDS_ATTENTION",
          issues: [{ code: "missing", message: "Garage Door is no longer available.", reference: null }],
        },
      },
    ];
    await settle(page);
    const text = page.shadowRoot?.textContent ?? "";
    expect(text).toContain("Needs attention");
    expect(text).toContain("When Garage Door stays open for 5 minutes, notify Everyone.");
    expect(text).not.toContain("binary_sensor.garage_door");
  });

  it("supports the garage stays-open composer with progressive options and recipient picker", async () => {
    const resolveTrigger = vi.fn().mockResolvedValue(trigger);
    const page = document.createElement(
      "notification-manager-rule-editor-page",
    ) as RuleEditorPage;
    page.api = { resolveTrigger } as unknown as NotificationManagerApi;
    page.currentUser = user;
    page.targets = [garage];
    page.recipients = [recipient];
    page.groups = [];
    const dirty = vi.fn();
    page.addEventListener("editor-dirty", dirty);
    document.body.append(page);
    await settle(page);

    const root = page.shadowRoot as ShadowRoot;
    const moreOptions = root.querySelector("details") as HTMLDetailsElement;
    expect(moreOptions.open).toBe(false);

    const semantic = root.querySelector("#semantic") as HTMLSelectElement;
    semantic.value = "REMAINS_OPEN";
    semantic.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(page);

    const everyone = root.querySelector(
      'input[name="audience"][value="EVERYONE"]',
    ) as HTMLInputElement;
    everyone.checked = true;
    everyone.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(page);

    expect(root.textContent).toContain(
      "When Garage Door stays open for 5 minutes, notify Everyone.",
    );
    expect(root.querySelector("#duration")).not.toBeNull();
    expect(dirty).toHaveBeenCalled();

    const choose = root.querySelector(
      'input[name="audience"][value="CHOOSE"]',
    ) as HTMLInputElement;
    choose.checked = true;
    choose.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(page);
    expect(root.textContent).toContain("Alice");
  });

  it("turns an optimistic concurrency error into product language", async () => {
    const api = {
      resolveTrigger: vi.fn().mockResolvedValue(trigger),
      updateRule: vi.fn().mockRejectedValue({
        code: "conflict",
        message: "Revision conflict",
      }),
    } as unknown as NotificationManagerApi;
    const page = document.createElement(
      "notification-manager-rule-editor-page",
    ) as RuleEditorPage;
    page.api = api;
    page.currentUser = user;
    page.rule = rule;
    page.targets = [garage];
    page.recipients = [recipient];
    document.body.append(page);
    await settle(page);

    const save = [...(page.shadowRoot?.querySelectorAll("notification-manager-button") ?? [])]
      .find((button) => button.textContent?.includes("Save notification")) as HTMLElement;
    save.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settle(page);

    expect(page.shadowRoot?.textContent).toContain(
      "This notification changed while you were editing it.",
    );
  });
});
