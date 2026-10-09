import { describe, expect, it } from "vitest";
// The morning job lives outside src (it runs on the owner's Mac); its class sorting is tested here.
import { classTypeOf, isNotAGroupClass, isOnlineClass } from "../../../tools/class-ingest/classify.mjs";

describe("FitnessNav class sorting", () => {
  it("sorts by the class name first", () => {
    expect(classTypeOf("FlowStrength | HYROX", "other")).toBe("lifting");
    expect(classTypeOf("FlowCycle 30 | Leaderboard", "other")).toBe("spin");
    expect(classTypeOf("FlowBarre | Signature - Taylor Swift", "other")).toBe("pilates");
    expect(classTypeOf("45 Min. Tru Classic Reformer *Grip Socks Required*", "pilates")).toBe("pilates");
    expect(classTypeOf("YS - Yoga Sculpt", "yoga")).toBe("yoga");
    expect(classTypeOf("CSX - CorePower Strength X (Full Body)", "yoga")).toBe("lifting");
    expect(classTypeOf("Hot 26 (90 min)", "yoga")).toBe("yoga");
    expect(classTypeOf("BODYPUMP", "other")).toBe("lifting");
  });
  it("leaves classes outside FitnessNav's list as other", () => {
    expect(classTypeOf("FlowDance Fitness | Zumba", "other")).toBe("other");
    expect(classTypeOf("BollyFusion with Rangeela", "other")).toBe("other");
  });
  it("falls back to the studio's kind for names that say nothing", () => {
    expect(classTypeOf("Full Body", "pilates")).toBe("pilates");
    expect(classTypeOf("Arms & Abs", "pilates")).toBe("pilates");
  });
  it("spots online classes", () => {
    expect(isOnlineClass("Vinyasa Flow at HOME")).toBe(true);
    expect(isOnlineClass("Live-streamed Hot Pilates")).toBe(true);
    expect(isOnlineClass("Hot Vinyasa Flow")).toBe(false);
  });
  it("drops trainings, workshops and very long sessions", () => {
    expect(isNotAGroupClass("STOTT PILATES Flowing Sequences on the Vertical Frame", "18:00", "20:00")).toBe(false);
    expect(isNotAGroupClass("Live Stream STOTT PILATES Programming Protocols for Breast Cancer Rehab", "10:00", "13:30")).toBe(true);
    expect(isNotAGroupClass("Teacher Training Weekend", "09:00", "10:00")).toBe(true);
    expect(isNotAGroupClass("Hot Vinyasa Flow", "16:00", "17:00")).toBe(false);
    expect(isNotAGroupClass("Open Gym", "10:00", "13:30")).toBe(true);
    // One-on-one appointments listed on a gym's page next to its group classes.
    expect(isNotAGroupClass("Personal Training (Ballard)", "08:00", "09:00")).toBe(true);
    expect(isNotAGroupClass("Strength Class (Ballard)", "09:00", "10:00")).toBe(false);
  });
});
