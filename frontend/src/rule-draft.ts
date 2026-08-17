import type {
  Audience,
  CapabilityTarget,
  CurrentUser,
  NotificationRule,
  ResolvedTrigger,
  Semantic,
  TriggerSpec,
} from "./models";

export const RUNTIME_SEMANTICS = new Set<Semantic>([
  "OPENED",
  "CLOSED",
  "REMAINS_OPEN",
  "REMAINS_CLOSED",
  "DETECTED",
  "CLEARED",
  "REMAINS_DETECTED",
]);

export interface TargetSource {
  key: string;
  name: string;
  kind: "device" | "entity";
  targets: CapabilityTarget[];
}

export type TargetReadiness = "ready" | "unavailable" | "unsupported";

export interface TargetInventory {
  discoveredTargets: CapabilityTarget[];
  runtimeTargets: CapabilityTarget[];
  usableTargets: CapabilityTarget[];
  sources: TargetSource[];
  discoveredSourceCount: number;
  readySourceCount: number;
}

export function targetSourceKey(target: CapabilityTarget): string {
  return target.device_id ? `device:${target.device_id}` : `entity:${target.entity_id}`;
}

export function groupTargetsBySource(targets: CapabilityTarget[]): TargetSource[] {
  const sources = new Map<string, TargetSource>();
  for (const target of targets) {
    const key = targetSourceKey(target);
    const existing = sources.get(key);
    if (existing) {
      existing.targets.push(target);
      continue;
    }
    sources.set(key, {
      key,
      name: target.device_name?.trim() || target.display_name,
      kind: target.device_id ? "device" : "entity",
      targets: [target],
    });
  }

  return [...sources.values()]
    .map((source) => ({
      ...source,
      targets: [...source.targets].sort(
        (left, right) =>
          left.display_name.localeCompare(right.display_name) ||
          left.entity_id.localeCompare(right.entity_id),
      ),
    }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.key.localeCompare(right.key),
    );
}

/** Targets discovered from Home Assistant that can be represented in the composer. */
export function discoveredTargets(targets: CapabilityTarget[]): CapabilityTarget[] {
  return targets.filter((target) => !target.synthetic);
}

/** True only for semantics the current runtime can actually evaluate. */
export function isRuntimeSupported(target: CapabilityTarget): boolean {
  return target.semantics.some((choice) => RUNTIME_SEMANTICS.has(choice.semantic));
}

export function supportedTargets(targets: CapabilityTarget[]): CapabilityTarget[] {
  return discoveredTargets(targets).filter(isRuntimeSupported);
}

/** Targets which can be selected and saved as a notification trigger today. */
export function usableTargets(targets: CapabilityTarget[]): CapabilityTarget[] {
  return supportedTargets(targets).filter((target) => target.available);
}

export function targetReadiness(target: CapabilityTarget): TargetReadiness {
  if (!isRuntimeSupported(target)) return "unsupported";
  return target.available ? "ready" : "unavailable";
}

export function targetInventory(targets: CapabilityTarget[]): TargetInventory {
  const discovered = discoveredTargets(targets);
  const usable = usableTargets(discovered);
  const sources = groupTargetsBySource(discovered);
  const readySourceKeys = new Set(usable.map(targetSourceKey));
  return {
    discoveredTargets: discovered,
    runtimeTargets: supportedTargets(discovered),
    usableTargets: usable,
    sources,
    discoveredSourceCount: sources.length,
    readySourceCount: readySourceKeys.size,
  };
}

export function supportedSemantics(target: CapabilityTarget | undefined) {
  return target?.semantics.filter((choice) => RUNTIME_SEMANTICS.has(choice.semantic)) ?? [];
}

export function semanticFromTrigger(
  trigger: TriggerSpec,
  target: CapabilityTarget | undefined,
): Semantic | undefined {
  const state = trigger.parameters.state;
  const duration = trigger.type === "BINARY_STATE_DURATION";
  if (target?.category === "motion") {
    if (duration && state === "on") return "REMAINS_DETECTED";
    if (!duration && state === "on") return "DETECTED";
    if (!duration && state === "off") return "CLEARED";
  }
  if (target?.category === "opening") {
    if (duration && state === "on") return "REMAINS_OPEN";
    if (duration && state === "off") return "REMAINS_CLOSED";
    if (!duration && state === "on") return "OPENED";
    if (!duration && state === "off") return "CLOSED";
  }
  return undefined;
}

const EVENT_PHRASES: Record<Semantic, string> = {
  OPENED: "opens",
  CLOSED: "closes",
  REMAINS_OPEN: "stays open",
  REMAINS_CLOSED: "stays closed",
  DETECTED: "detects activity",
  CLEARED: "clears",
  REMAINS_DETECTED: "keeps detecting activity",
  ARRIVES: "arrives home",
  LEAVES: "leaves home",
  ABOVE: "rises above the selected value",
  BELOW: "falls below the selected value",
  AT_TIME: "reaches the selected time",
};

function durationText(minutes: number): string {
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export function reviewSentence(
  targetName: string,
  semantic: Semantic,
  durationMinutes: number,
  audienceName: string,
): string {
  const duration = semantic.startsWith("REMAINS_")
    ? ` for ${durationText(durationMinutes)}`
    : "";
  return `When ${targetName} ${EVENT_PHRASES[semantic]}${duration}, notify ${audienceName}.`;
}

export function generatedMessage(
  targetName: string,
  semantic: Semantic,
  durationMinutes: number,
): { name: string; title: string; message: string } {
  const lowerName = targetName.toLocaleLowerCase();
  switch (semantic) {
    case "REMAINS_OPEN":
      return {
        name: `${targetName} left open`,
        title: targetName,
        message: `The ${lowerName} has been open for ${durationText(durationMinutes)}.`,
      };
    case "REMAINS_CLOSED":
      return {
        name: `${targetName} stayed closed`,
        title: targetName,
        message: `The ${lowerName} has been closed for ${durationText(durationMinutes)}.`,
      };
    case "REMAINS_DETECTED":
      return {
        name: `${targetName} activity continues`,
        title: targetName,
        message: `${targetName} has detected activity for ${durationText(durationMinutes)}.`,
      };
    case "OPENED":
      return { name: `${targetName} opened`, title: targetName, message: `${targetName} opened.` };
    case "CLOSED":
      return { name: `${targetName} closed`, title: targetName, message: `${targetName} closed.` };
    case "DETECTED":
      return {
        name: `${targetName} activity`,
        title: targetName,
        message: `${targetName} detected activity.`,
      };
    case "CLEARED":
      return {
        name: `${targetName} cleared`,
        title: targetName,
        message: `${targetName} is clear.`,
      };
    default:
      return { name: targetName, title: targetName, message: `${targetName} changed.` };
  }
}

export function createNotificationRule(
  currentUser: CurrentUser,
  resolvedTrigger: ResolvedTrigger,
  values: {
    id: string;
    existing?: NotificationRule | undefined;
    name: string;
    audiences: Audience[];
    title: string;
    message: string;
    imageUrl: string | null;
    deepLink: string | null;
    conditions: NotificationRule["conditions"];
    urgency: NotificationRule["delivery_policy"]["urgency"];
    sound: string | null;
    cooldownSeconds: number | null;
    replacePrevious: boolean;
  },
): NotificationRule {
  const now = new Date().toISOString();
  return {
    id: values.existing?.id ?? values.id,
    revision: values.existing?.revision ?? 0,
    schema_version: values.existing?.schema_version ?? 1,
    name: values.name.trim(),
    enabled: values.existing?.enabled ?? true,
    owner_user_id: values.existing?.owner_user_id ?? currentUser.id,
    scope: values.existing?.scope ?? (currentUser.is_admin ? "HOUSEHOLD" : "PERSONAL"),
    trigger: resolvedTrigger,
    conditions: values.conditions,
    audiences: values.audiences,
    content: {
      title: values.title.trim(),
      message: values.message.trim(),
      image_url: values.imageUrl,
      deep_link: values.deepLink,
      actions: values.existing?.content.actions ?? [],
    },
    delivery_policy: {
      urgency: values.urgency,
      deduplicate_endpoints: true,
      sound: values.sound,
    },
    behaviour: {
      cooldown_seconds: values.cooldownSeconds,
      reminder_after_seconds: values.existing?.behaviour.reminder_after_seconds ?? null,
      repeat_every_seconds: values.existing?.behaviour.repeat_every_seconds ?? null,
      max_repeats: values.existing?.behaviour.max_repeats ?? null,
      stop_when_resolved: values.existing?.behaviour.stop_when_resolved ?? false,
      replace_previous: values.replacePrevious,
    },
    health: values.existing?.health ?? { status: "HEALTHY", issues: [] },
    created_at: values.existing?.created_at ?? now,
    updated_at: now,
  };
}

export function newRuleId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
