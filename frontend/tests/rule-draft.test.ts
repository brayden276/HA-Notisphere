import { describe, expect, it } from "vitest";

import type { CapabilityTarget, CurrentUser, ResolvedTrigger } from "../src/models";
import {
  createNotificationRule,
  generatedMessage,
  groupTargetsBySource,
  reviewSentence,
  semanticFromTrigger,
  supportedSemantics,
  supportedTargets,
  targetInventory,
  targetReadiness,
  usableTargets,
} from "../src/rule-draft";

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

describe("rule composer domain helpers", () => {
  it("supports the required garage duration flow without exposing raw state language", () => {
    const generated = generatedMessage("Garage Door", "REMAINS_OPEN", 5);

    expect(reviewSentence("Garage Door", "REMAINS_OPEN", 5, "Everyone")).toBe(
      "When Garage Door stays open for 5 minutes, notify Everyone.",
    );
    expect(generated).toEqual({
      name: "Garage Door left open",
      title: "Garage Door",
      message: "The garage door has been open for 5 minutes.",
    });
    expect(JSON.stringify(generated)).not.toContain("binary_sensor");
    expect(JSON.stringify(generated)).not.toContain('state: "on"');
  });

  it("offers only trigger semantics implemented by the v1 runtime", () => {
    const person: CapabilityTarget = {
      ...garage,
      entity_id: "person.alice",
      display_name: "Alice",
      domain: "person",
      device_class: null,
      category: "person",
      semantics: [{ semantic: "ARRIVES", label: "Arrives home", parameters: [] }],
    };

    expect(supportedTargets([garage, person])).toEqual([garage]);
    expect(supportedSemantics(garage).map((item) => item.semantic)).toEqual([
      "OPENED",
      "REMAINS_OPEN",
    ]);
  });

  it("keeps every discovered signal visible while separating ready signals from unavailable and unsupported ones", () => {
    const unavailable: CapabilityTarget = { ...garage, entity_id: "binary_sensor.back_door", available: false };
    const temperature: CapabilityTarget = {
      ...garage,
      entity_id: "sensor.garage_temperature",
      category: "temperature",
      available: false,
      semantics: [{ semantic: "ABOVE", label: "Rises above", parameters: [] }],
    };
    const synthetic: CapabilityTarget = { ...garage, entity_id: "time", synthetic: true };
    const standalone = {
      ...garage,
      entity_id: "binary_sensor.side_gate",
      device_id: null,
      device_name: null,
    };

    const inventory = targetInventory([garage, unavailable, temperature, standalone, synthetic]);

    expect(inventory.discoveredTargets).toHaveLength(4);
    expect(inventory.runtimeTargets).toEqual([garage, unavailable, standalone]);
    expect(usableTargets(inventory.discoveredTargets)).toEqual([garage, standalone]);
    expect(targetReadiness(unavailable)).toBe("unavailable");
    expect(targetReadiness(temperature)).toBe("unsupported");
    expect(inventory.sources.find((source) => source.name === "Garage")?.targets).toHaveLength(3);
    expect(inventory.discoveredSourceCount).toBe(2);
    expect(inventory.readySourceCount).toBe(2);
  });

  it("groups a device's signals while keeping standalone entities selectable", () => {
    const motion: CapabilityTarget = {
      ...garage,
      entity_id: "binary_sensor.garage_motion",
      display_name: "Garage Motion",
      device_class: "motion",
      category: "motion",
    };
    const standalone: CapabilityTarget = {
      ...garage,
      entity_id: "binary_sensor.side_gate",
      display_name: "Side Gate",
      registry_id: "registry-side-gate",
      device_id: null,
      device_name: null,
    };

    const sources = groupTargetsBySource([standalone, motion, garage]);

    expect(sources.map((source) => [source.name, source.kind, source.targets.length])).toEqual([
      ["Garage", "device", 2],
      ["Side Gate", "entity", 1],
    ]);
    expect(sources[0]?.targets.map((target) => target.display_name)).toEqual([
      "Garage Door",
      "Garage Motion",
    ]);
  });

  it("creates a complete server contract and can infer its human semantic", () => {
    const user: CurrentUser = { id: "user-1", name: "Alice", is_admin: true };
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

    const rule = createNotificationRule(user, trigger, {
      id: "rule-1",
      name: "Garage Door left open",
      audiences: [{ type: "EVERYONE", recipient_id: null, group_id: null }],
      title: "Garage Door",
      message: "The garage door has been open for 5 minutes.",
      imageUrl: null,
      deepLink: null,
      conditions: [],
      urgency: "NORMAL",
      sound: null,
      cooldownSeconds: 600,
      replacePrevious: true,
    });

    expect(rule.scope).toBe("HOUSEHOLD");
    expect(rule.revision).toBe(0);
    expect(rule.behaviour.cooldown_seconds).toBe(600);
    expect(semanticFromTrigger(rule.trigger, garage)).toBe("REMAINS_OPEN");
  });
});
