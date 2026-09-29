import { describe, expect, it } from "vitest";
import { selectOpenMicsForSeattleDate } from "@/lib/listings/select";
import { normalizeOpenMicRecord } from "@/lib/listings/record";

function R(name: string, time: string, day = "monday") {
  return normalizeOpenMicRecord({ id: name, name, timeSignupStart: time, [day]: "Yes" })!;
}

const MICS = [
  R("Late", "/9pm"),
  R("Early", "/6pm"),
  R("Signup only", "6:30pm/"),
  R("TBD", ""),
  R("Bravo", "/7pm"),
  R("Alpha", "/7pm"),
  R("Tuesday only", "/7pm", "tuesday"),
];

const names = (mics: { name: string }[]) => mics.map((mic) => mic.name);

describe("selectOpenMicsForSeattleDate", () => {
  it("orders the day's mics and picks first/last without a current time", () => {
    const result = selectOpenMicsForSeattleDate(MICS, new Date(Date.UTC(2026, 8, 28, 20)), false);
    expect(result.dayName).toBe("Monday");
    expect(names(result.todays)).toEqual(["Early", "Signup only", "Alpha", "Bravo", "Late", "TBD"]);
    expect(result.nextMic?.name).toBe("Early");
    expect(result.lastMic?.name).toBe("TBD");
  });

  it("keeps the first mic as next before anything has started (5:00 PM Seattle)", () => {
    const result = selectOpenMicsForSeattleDate(MICS, new Date("2026-09-29T00:00:00Z"), true);
    expect(result.nextMic?.name).toBe("Early");
  });

  it("picks the earliest mic in the latest started tier (7:15 PM Seattle)", () => {
    const result = selectOpenMicsForSeattleDate(MICS, new Date("2026-09-29T02:15:00Z"), true);
    expect(result.nextMic?.name).toBe("Alpha");
  });

  it("picks the last started mic when all have begun (11:00 PM Seattle)", () => {
    const result = selectOpenMicsForSeattleDate(MICS, new Date("2026-09-29T06:00:00Z"), true);
    expect(result.nextMic?.name).toBe("Late");
    expect(result.lastMic?.name).toBe("TBD");
  });

  it("breaks same-time ties by distance when a distanceMiles function is given", () => {
    const result = selectOpenMicsForSeattleDate(
      MICS,
      new Date(Date.UTC(2026, 8, 28, 20)),
      false,
      (mic) => ({ Alpha: 5, Bravo: 1 } as Record<string, number>)[mic.name]
    );
    expect(names(result.todays)).toEqual(["Early", "Signup only", "Bravo", "Alpha", "Late", "TBD"]);
  });

  it("returns an empty day when the mic does not occur on that weekday", () => {
    const result = selectOpenMicsForSeattleDate(
      [R("Tuesday only", "/7pm", "tuesday")],
      new Date(Date.UTC(2026, 8, 28, 20)),
      true
    );
    expect(result.todays).toEqual([]);
    expect(result.nextMic).toBeNull();
    expect(result.lastMic).toBeNull();
  });

  it("uses the single mic for both next and last", () => {
    const result = selectOpenMicsForSeattleDate(
      [R("Early", "/6pm")],
      new Date(Date.UTC(2026, 8, 28, 20)),
      false
    );
    expect(result.nextMic?.name).toBe("Early");
    expect(result.lastMic?.name).toBe("Early");
  });
});
