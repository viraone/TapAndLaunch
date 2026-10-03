import { describe, expect, it } from "vitest";
import { driveMinutes, travelEstimate, walkLabel, walkMinutes } from "@/lib/food/walk";

describe("walk time", () => {
  it("is never under a minute, even next door", () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(0.01)).toBe(1);
    expect(walkLabel(0)).toBe("1 min");
  });

  it("allows about 26 minutes per straight-line mile (3 mph, streets 30% longer)", () => {
    expect(walkMinutes(0.5)).toBe(13);
    expect(walkMinutes(1)).toBe(26);
    expect(walkMinutes(1.2)).toBe(31);
  });

  it("switches to hours past 59 minutes", () => {
    expect(walkLabel(2)).toBe("52 min");
    expect(walkLabel(2.5)).toBe("1 hr 5 min");
    expect(walkLabel(4.6)).toBe("2 hr");
  });

  it("treats a negative distance as zero", () => {
    expect(walkMinutes(-3)).toBe(1);
  });
});

describe("travel estimate on the card", () => {
  it("walks when it's 20 minutes or less", () => {
    expect(travelEstimate(0.5)).toEqual({ mode: "walking", minutes: 13, label: "~13 min" });
    expect(travelEstimate(0.76).mode).toBe("walking"); // 19.76 → 20 min
  });

  it("drives when the walk would be longer", () => {
    expect(travelEstimate(1.2)).toEqual({ mode: "driving", minutes: 7, label: "~7 min" });
    expect(travelEstimate(2).minutes).toBe(11);
  });

  it("never estimates a drive under 2 minutes", () => {
    expect(driveMinutes(0)).toBe(2);
  });
});
