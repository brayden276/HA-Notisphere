import { describe, expect, it } from "vitest";

import { activityOutcome, recipientOutcome } from "../src/activity-format";
import type { ActivityRecord, RecipientResult } from "../src/models";

function result(
  recipientName: string,
  status: RecipientResult["status"],
  reason: string | null = null,
): RecipientResult {
  return {
    recipient_id: recipientName.toLocaleLowerCase(),
    recipient_name: recipientName,
    endpoint_id: null,
    endpoint_name: null,
    status,
    reason,
  };
}

function record(results: RecipientResult[]): ActivityRecord {
  return {
    id: "activity-1",
    rule_id: "rule-1",
    occurrence_id: "occurrence-1",
    timestamp: "2026-08-16T00:00:00Z",
    trigger_summary: "Garage Door remained open for 5 minutes",
    status: "PARTIAL",
    recipient_results: results,
    reason: "One phone could not be reached.",
  };
}

describe("human activity formatting", () => {
  it("explains partial delivery by household member", () => {
    const activity = record([
      result("Brayden", "SENT"),
      result("Sarah", "FAILED", "This phone could not be reached."),
    ]);

    expect(activityOutcome(activity)).toBe("Sent to Brayden; could not reach Sarah");
    expect(recipientOutcome(activity.recipient_results[1]!)).toBe(
      "Sarah: This phone could not be reached.",
    );
  });

  it("uses the recorded reason when no person was resolved", () => {
    const activity = record([]);
    activity.status = "SKIPPED";

    expect(activityOutcome(activity)).toBe("One phone could not be reached.");
  });
});
