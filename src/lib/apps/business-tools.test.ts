import { describe, expect, it } from "vitest";
import { BUSINESS_TOOLS, schedulingCardSummary } from "./business-tools";

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

describe("Scheduling card summary", () => {
  it("leads with today's visits and ends with the customer count", () => {
    expect(schedulingCardSummary(3, 24)).toBe("Today: 3 visits · 24 customers");
  });

  it("says one visit and one customer in the singular", () => {
    expect(schedulingCardSummary(1, 1)).toBe("Today: 1 visit · 1 customer");
  });

  it("does not call a quiet day bad news", () => {
    expect(schedulingCardSummary(0, 24)).toBe("No visits today · 24 customers");
  });

  it("says there are no customers yet when the business has none", () => {
    expect(schedulingCardSummary(3, 0)).toBe("Today: 3 visits · No customers yet");
  });

  it("nudges the first customer when there is nothing at all", () => {
    expect(schedulingCardSummary(0, 0)).toBe("Nothing yet. Add your first customer.");
  });
});
