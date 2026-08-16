export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type RuleScope = "PERSONAL" | "HOUSEHOLD";
export type TriggerType =
  | "BINARY_STATE"
  | "BINARY_STATE_DURATION"
  | "NUMERIC_THRESHOLD"
  | "PRESENCE"
  | "TIME";
export type ConditionType =
  | "PERSON_HOME"
  | "PERSON_AWAY"
  | "TIME_WINDOW"
  | "ENTITY_STATE";
export type AudienceType = "ME" | "RECIPIENT" | "GROUP" | "EVERYONE" | "ADMINS";
export type EndpointCapability =
  | "title"
  | "critical"
  | "image"
  | "actions"
  | "deep_link"
  | "replacement"
  | "sound";
export type Urgency = "NORMAL" | "IMPORTANT" | "CRITICAL";
export type RuleHealthStatus = "HEALTHY" | "DEGRADED" | "NEEDS_ATTENTION";
export type ActivityStatus = "SENT" | "PARTIAL" | "SKIPPED" | "FAILED" | "TEST";
export type RecipientResultStatus = "SENT" | "SKIPPED" | "FAILED";
export type GroupType = "CUSTOM" | "SYSTEM";
export type SystemGroupType = "EVERYONE" | "ADMINS";

export interface CurrentUser {
  id: string;
  name: string;
  is_admin: boolean;
}

export interface TargetRef {
  entity_id: string;
  registry_id: string | null;
  device_id: string | null;
  domain: string;
  device_class: string | null;
  display_name_snapshot: string;
}

export interface TriggerSpec {
  type: TriggerType;
  target: TargetRef | null;
  parameters: Record<string, JsonValue>;
}

export interface ConditionSpec {
  type: ConditionType;
  target: TargetRef | null;
  parameters: Record<string, JsonValue>;
}

export interface Audience {
  type: AudienceType;
  recipient_id: string | null;
  group_id: string | null;
}

export interface NotificationAction {
  id: string;
  title: string;
  uri: string | null;
}

export interface NotificationContent {
  title: string;
  message: string;
  image_url: string | null;
  deep_link: string | null;
  actions: NotificationAction[];
}

export interface DeliveryPolicy {
  urgency: Urgency;
  deduplicate_endpoints: boolean;
  sound: string | null;
}

export interface NotificationBehaviour {
  cooldown_seconds: number | null;
  reminder_after_seconds: number | null;
  repeat_every_seconds: number | null;
  max_repeats: number | null;
  stop_when_resolved: boolean;
  replace_previous: boolean;
}

export interface HealthIssue {
  code: string;
  message: string;
  reference: string | null;
}

export interface RuleHealth {
  status: RuleHealthStatus;
  issues: HealthIssue[];
}

export interface NotificationRule {
  id: string;
  revision: number;
  schema_version: number;
  name: string;
  enabled: boolean;
  owner_user_id: string;
  scope: RuleScope;
  trigger: TriggerSpec;
  conditions: ConditionSpec[];
  audiences: Audience[];
  content: NotificationContent;
  delivery_policy: DeliveryPolicy;
  behaviour: NotificationBehaviour;
  health: RuleHealth;
  created_at: string;
  updated_at: string;
}

export interface DeliveryEndpoint {
  id: string;
  type: "HA_NOTIFY";
  target: string;
  platform: string;
  capabilities: EndpointCapability[];
  enabled: boolean;
  priority: number;
}

export interface RecipientPreferences {
  preferred_endpoint_id: string | null;
  allow_critical: boolean;
}

export interface RecipientProfile {
  id: string;
  ha_user_id: string;
  person_entity_id: string | null;
  display_name: string;
  endpoints: DeliveryEndpoint[];
  preferences: RecipientPreferences;
}

export interface RecipientGroup {
  id: string;
  name: string;
  type: GroupType;
  member_recipient_ids: string[];
  system_type: SystemGroupType | null;
}

export interface RecipientResult {
  recipient_id: string;
  recipient_name: string;
  endpoint_id: string | null;
  endpoint_name: string | null;
  status: RecipientResultStatus;
  reason: string | null;
}

export interface ActivityRecord {
  id: string;
  rule_id: string;
  occurrence_id: string;
  timestamp: string;
  trigger_summary: string;
  status: ActivityStatus;
  recipient_results: RecipientResult[];
  reason: string | null;
}

export type TargetCategory =
  | "opening"
  | "motion"
  | "person"
  | "temperature"
  | "humidity"
  | "battery"
  | "time";
export type Semantic =
  | "OPENED"
  | "CLOSED"
  | "REMAINS_OPEN"
  | "REMAINS_CLOSED"
  | "DETECTED"
  | "CLEARED"
  | "REMAINS_DETECTED"
  | "ARRIVES"
  | "LEAVES"
  | "ABOVE"
  | "BELOW"
  | "AT_TIME";

export interface ParameterSchema {
  key: string;
  type: "number" | "integer" | "time";
  label: string;
  required: boolean;
  unit: string | null;
  minimum: number | null;
}

export interface SemanticChoice {
  semantic: Semantic;
  label: string;
  parameters: ParameterSchema[];
}

export interface CapabilityTarget {
  entity_id: string;
  display_name: string;
  domain: string;
  device_class: string | null;
  category: TargetCategory;
  available: boolean;
  registry_id: string | null;
  device_id: string | null;
  device_name: string | null;
  unit: string | null;
  synthetic: boolean;
  semantics: SemanticChoice[];
}

export interface UnconfirmedRecipientMapping {
  [key: string]: JsonValue;
}

export interface BootstrapData {
  current_user: CurrentUser;
  rules: NotificationRule[];
  recipients: RecipientProfile[];
  groups: RecipientGroup[];
  activity: ActivityRecord[];
  unconfirmed_recipient_mappings: UnconfirmedRecipientMapping[];
  capability_targets: CapabilityTarget[];
}
