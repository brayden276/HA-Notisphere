import type { ActivityRecord, RecipientResult } from "./models";

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

export function recipientOutcome(result: RecipientResult): string {
  if (result.status === "SENT") return `${result.recipient_name} — sent`;
  if (result.status === "FAILED") {
    return `${result.recipient_name} — ${result.reason ?? "could not be reached"}`;
  }
  return `${result.recipient_name} — ${result.reason ?? "not eligible for this notification"}`;
}

export function activityOutcome(record: ActivityRecord): string {
  const sent = record.recipient_results
    .filter((result) => result.status === "SENT")
    .map((result) => result.recipient_name);
  const failed = record.recipient_results
    .filter((result) => result.status === "FAILED")
    .map((result) => result.recipient_name);
  const skipped = record.recipient_results
    .filter((result) => result.status === "SKIPPED")
    .map((result) => result.recipient_name);
  const parts: string[] = [];
  if (sent.length) parts.push(`${record.status === "TEST" ? "Test sent" : "Sent"} to ${joinNames(sent)}`);
  if (failed.length) parts.push(`could not reach ${joinNames(failed)}`);
  if (skipped.length) parts.push(`skipped ${joinNames(skipped)}`);
  return parts.length ? parts.join("; ") : record.reason ?? record.status.toLocaleLowerCase();
}
