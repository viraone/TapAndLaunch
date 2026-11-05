import { describe, expect, it } from "vitest";
import { BUSINESS_TOOLS } from "./business-tools";

describe("Business tools links", () => {
  it("has the four Scheduling sections, in the order the app home page lists them", () => {
    expect(BUSINESS_TOOLS.map((tool) => tool.path)).toEqual(["schedule", "customers", "reminders", "automation"]);
  });

  it("labels each one the way the app home page does", () => {
    expect(BUSINESS_TOOLS.map((tool) => tool.label)).toEqual(["Schedule", "Customers", "Reminders", "Automation"]);
  });

  it("gives every link a one-line hint and an icon", () => {
    for (const tool of BUSINESS_TOOLS) {
      expect(tool.hint.length).toBeGreaterThan(0);
      expect(tool.hint).not.toContain("\n");
      expect(tool.icon).toBeTruthy();
    }
  });
});
