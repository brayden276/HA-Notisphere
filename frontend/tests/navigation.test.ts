import { describe, expect, it } from "vitest";

import {
  hrefForRoute,
  navigationForUser,
  routeForUser,
  routeFromHash,
} from "../src/navigation";

describe("notification manager navigation", () => {
  it.each([
    ["", "notifications"],
    ["#/notifications", "notifications"],
    ["#/people", "people"],
    ["#activity", "activity"],
    ["#/settings?tab=discovery", "settings"],
    ["#/unknown", "notifications"],
  ] as const)("maps %s to %s", (hash, expected) => {
    expect(routeFromHash(hash)).toBe(expected);
  });

  it("hides settings and rejects its route for non-admin users", () => {
    expect(navigationForUser(false).map((item) => item.route)).toEqual([
      "notifications",
      "people",
      "activity",
    ]);
    expect(routeForUser("settings", false)).toBe("notifications");
  });

  it("shows settings to administrators", () => {
    expect(navigationForUser(true).map((item) => item.route)).toContain("settings");
    expect(routeForUser("settings", true)).toBe("settings");
    expect(hrefForRoute("settings")).toBe("#/settings");
  });
});
