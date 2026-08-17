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
import "../src/pages/people-groups-page";
import "../src/pages/rule-editor-page";
import "../src/pages/settings-page";
import type { NotificationsPage } from "../src/pages/notifications-page";
import type { PeopleGroupsPage } from "../src/pages/people-groups-page";
import type { RuleEditorPage } from "../src/pages/rule-editor-page";
import type { SettingsPage } from "../src/pages/settings-page";

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
const garageMotion: CapabilityTarget = {
  ...garage,
  entity_id: "binary_sensor.garage_motion",
  display_name: "Garage Motion",
  registry_id: "registry-garage-motion",
  device_class: "motion",
  category: "motion",
  semantics: [
    { semantic: "DETECTED", label: "Detects activity", parameters: [] },
    { semantic: "CLEARED", label: "Clears", parameters: [] },
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
  it("guides first-run users from an automatically discovered phone to creation", async () => {
    const page = document.createElement(
      "notification-manager-people-groups-page",
    ) as PeopleGroupsPage;
    page.currentUser = user;
    page.recipients = [recipient];
    page.groups = [];
    page.onboarding = true;
    const create = vi.fn();
    page.addEventListener("create-first-notification", create);
    document.body.append(page);
    await settle(page);

    const root = page.shadowRoot as ShadowRoot;
    const status = root.querySelector("notification-manager-status-panel") as HTMLElement & {
      heading: string;
      message: string;
    };
    expect(status.heading).toBe("Your household is ready");
    expect(status.message).toContain("1 notification phone is ready");
    const button = [...root.querySelectorAll("notification-manager-button")].find((item) =>
      item.textContent?.includes("Create first notification"),
    ) as HTMLElement;
    button.click();
    expect(create).toHaveBeenCalledOnce();
  });

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
    expect(root.querySelector(".editor-layout")).not.toBeNull();
    expect(root.querySelector(".review-panel")).not.toBeNull();
    expect(root.querySelector(".section-number")).toBeNull();
    expect([...root.querySelectorAll("h3")].map((heading) => heading.textContent?.trim())).toEqual(
      ["Device", "Signal", "Behaviour", "Recipients", "Message", "Review"],
    );
    const moreOptions = root.querySelector("details") as HTMLDetailsElement;
    expect(moreOptions.open).toBe(false);

    const semantic = [...root.querySelectorAll<HTMLButtonElement>(".behaviour-option")].find(
      (button) => button.textContent?.includes("Stays open"),
    ) as HTMLButtonElement;
    semantic.click();
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

  it("moves from a device to one of its signals and then adapts the behaviours", async () => {
    const page = document.createElement(
      "notification-manager-rule-editor-page",
    ) as RuleEditorPage;
    page.api = { resolveTrigger: vi.fn() } as unknown as NotificationManagerApi;
    page.currentUser = user;
    page.targets = [garage, garageMotion];
    page.recipients = [recipient];
    document.body.append(page);
    await settle(page);

    const root = page.shadowRoot as ShadowRoot;
    const device = root.querySelector(".source-option") as HTMLButtonElement;
    expect(device.textContent).toContain("Garage");
    expect(device.querySelector(".option-count")?.textContent).toMatch(/2\s+of\s+2\s+ready/);
    expect(root.querySelectorAll(".source-option")).toHaveLength(1);
    expect(root.querySelectorAll(".signal-option")).toHaveLength(2);

    device.click();
    await settle(page);
    expect(root.querySelector("#source-search")).toBeNull();
    const selectedDevice = root.querySelector(".source-summary") as HTMLButtonElement;
    expect(selectedDevice.textContent).toContain("Change");

    selectedDevice.click();
    await settle(page);
    expect(root.querySelector("#source-search")).not.toBeNull();
    expect(root.activeElement).toBe(root.querySelector("#source-search"));

    const motion = [...root.querySelectorAll<HTMLButtonElement>(".signal-option")].find(
      (button) => button.textContent?.includes("Garage Motion"),
    ) as HTMLButtonElement;
    motion.click();
    await settle(page);

    expect(motion.getAttribute("aria-pressed")).toBe("true");
    expect(root.textContent).toContain("Detects activity");
    expect(root.textContent).toContain("Clears");
    expect(root.textContent).not.toContain("Stays open");
    expect(root.textContent).toContain("When Garage Motion detects activity, notify me.");
    expect(root.querySelectorAll(".mobile-actions notification-manager-button")).toHaveLength(2);
  });

  it("shows discovered but unsupported signals without allowing them to reach the runtime", async () => {
    const temperature: CapabilityTarget = {
      ...garage,
      entity_id: "sensor.garage_temperature",
      display_name: "Garage temperature",
      category: "temperature",
      semantics: [{ semantic: "ABOVE", label: "Rises above", parameters: [] }],
    };
    const unavailable: CapabilityTarget = {
      ...garage,
      entity_id: "binary_sensor.garage_side_door",
      display_name: "Side door",
      available: false,
    };
    const page = document.createElement(
      "notification-manager-rule-editor-page",
    ) as RuleEditorPage;
    page.api = { resolveTrigger: vi.fn() } as unknown as NotificationManagerApi;
    page.currentUser = user;
    page.targets = [garage, temperature, unavailable];
    page.recipients = [recipient];
    document.body.append(page);
    await settle(page);

    const root = page.shadowRoot as ShadowRoot;
    expect(root.querySelector(".option-count")?.textContent).toMatch(/1\s+of\s+3\s+ready/);
    const unsupported = [...root.querySelectorAll<HTMLButtonElement>(".signal-option")].find(
      (button) => button.textContent?.includes("Garage temperature"),
    ) as HTMLButtonElement;
    expect(unsupported.disabled).toBe(true);
    expect(unsupported.textContent).toContain("Not supported for notifications yet");
    const unavailableSignal = [...root.querySelectorAll<HTMLButtonElement>(".signal-option")].find(
      (button) => button.textContent?.includes("Side door"),
    ) as HTMLButtonElement;
    expect(unavailableSignal.disabled).toBe(true);
    expect(unavailableSignal.textContent).toContain("Unavailable");
  });

  it("uses truthful discovery terminology in settings", async () => {
    const page = document.createElement(
      "notification-manager-settings-page",
    ) as SettingsPage;
    page.capabilityTargets = [garage, { ...garage, entity_id: "sensor.garage_temperature", category: "temperature", semantics: [{ semantic: "ABOVE", label: "Rises above", parameters: [] }] }];
    document.body.append(page);
    await settle(page);

    const text = page.shadowRoot?.textContent ?? "";
    expect(text).toContain("Discovered signals");
    expect(text).toContain("Ready notification signals");
    expect(text).toContain("Devices and entities with ready signals");
    expect(text).not.toContain("Available devices");
  });

  it("keeps an unavailable existing trigger selected until the user chooses a ready replacement", async () => {
    const unavailable = {
      ...garage,
      entity_id: "binary_sensor.side_door",
      display_name: "Side Door",
      available: false,
    };
    const resolveTrigger = vi.fn();
    const page = document.createElement(
      "notification-manager-rule-editor-page",
    ) as RuleEditorPage;
    page.api = { resolveTrigger } as unknown as NotificationManagerApi;
    page.currentUser = user;
    page.rule = {
      ...rule,
      trigger: {
        ...rule.trigger,
        target: { ...trigger.target!, entity_id: unavailable.entity_id, display_name_snapshot: unavailable.display_name },
      },
    };
    page.targets = [garage, unavailable];
    page.recipients = [recipient];
    document.body.append(page);
    await settle(page);

    const root = page.shadowRoot as ShadowRoot;
    expect(root.querySelector(".source-summary")?.textContent).toContain("Garage");
    const selected = [...root.querySelectorAll<HTMLButtonElement>(".signal-option")].find(
      (button) => button.textContent?.includes("Side Door"),
    ) as HTMLButtonElement;
    expect(selected.textContent).toContain("Side Door");
    expect(selected.disabled).toBe(true);
    expect(selected.getAttribute("aria-pressed")).toBe("true");

    const save = [...root.querySelectorAll("notification-manager-button")].find((button) =>
      button.textContent?.includes("Save notification"),
    ) as HTMLElement;
    save.click();
    await settle(page);
    expect(resolveTrigger).not.toHaveBeenCalled();
    expect(root.textContent).toContain("Choose an available notification-ready signal.");
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

    expect(page.shadowRoot?.querySelector("#source-search")).toBeNull();
    expect(page.shadowRoot?.querySelector(".source-summary")?.textContent).toContain("Garage");

    const save = [...(page.shadowRoot?.querySelectorAll("notification-manager-button") ?? [])]
      .find((button) => button.textContent?.includes("Save notification")) as HTMLElement;
    save.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settle(page);

    expect(page.shadowRoot?.textContent).toContain(
      "This notification changed while you were editing it.",
    );
  });

  it("builds multiple AND conditions including a human device-state condition", async () => {
    const createRule = vi.fn().mockImplementation(async (draft: NotificationRule) => draft);
    const api = {
      resolveTrigger: vi.fn().mockResolvedValue(trigger),
      createRule,
    } as unknown as NotificationManagerApi;
    const page = document.createElement(
      "notification-manager-rule-editor-page",
    ) as RuleEditorPage;
    page.api = api;
    page.currentUser = user;
    page.targets = [garage];
    page.recipients = [recipient];
    document.body.append(page);
    await settle(page);

    const root = page.shadowRoot as ShadowRoot;
    (root.querySelector(".add-condition") as HTMLButtonElement).click();
    await settle(page);
    let kind = root.querySelector('[id^="condition-kind-"]') as HTMLSelectElement;
    kind.value = "ENTITY_STATE";
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(page);
    const target = root.querySelector('[id^="condition-target-"]') as HTMLSelectElement;
    target.value = garage.entity_id;
    target.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(page);
    const state = root.querySelector('[id^="condition-state-"]') as HTMLSelectElement;
    state.value = "off";
    state.dispatchEvent(new Event("change", { bubbles: true }));
    (root.querySelector(".add-condition") as HTMLButtonElement).click();
    await settle(page);
    const kinds = root.querySelectorAll('[id^="condition-kind-"]');
    kind = kinds[1] as HTMLSelectElement;
    kind.value = "TIME_WINDOW";
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    await settle(page);

    const save = [...root.querySelectorAll("notification-manager-button")].find((button) =>
      button.textContent?.includes("Save notification"),
    ) as HTMLElement;
    save.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settle(page);

    const saved = createRule.mock.calls[0]?.[0] as NotificationRule;
    expect(saved.conditions).toHaveLength(2);
    expect(saved.conditions[0]).toMatchObject({
      type: "ENTITY_STATE",
      parameters: { state: "off" },
      target: { display_name_snapshot: "Garage Door" },
    });
    expect(saved.conditions[1]).toMatchObject({
      type: "TIME_WINDOW",
      parameters: { start: "22:00", end: "06:00" },
    });
    expect(root.textContent).toContain("All conditions must be met.");
  });
});
