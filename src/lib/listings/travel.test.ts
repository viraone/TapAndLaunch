import { describe, expect, it } from "vitest";
import {
  buildTripReminder,
  calculateHaversineMiles,
  estimateOpenMicDriveMinutes,
  estimateOpenMicTransitMinutes,
  getOpenMicTravelEstimate,
  getTripTrafficCondition,
  getWeatherCondition,
  summarizeNearbyParking,
} from "@/lib/listings/travel";
import { normalizeOpenMicRecord, type OpenMic } from "@/lib/listings/record";

const CAPITOL_HILL = { latitude: 47.6205, longitude: -122.3212 };

function mic(record: Record<string, unknown>): OpenMic {
  const normalized = normalizeOpenMicRecord(record);
  if (!normalized) throw new Error("test record did not normalize");
  return normalized;
}

describe("travel estimates", () => {
  it("measures straight-line miles", () => {
    // Seattle to Tacoma is about 25 miles as the crow flies.
    expect(calculateHaversineMiles(47.6062, -122.3321, 47.2529, -122.4443)).toBeCloseTo(25.0, 1);
    expect(calculateHaversineMiles(47.6, -122.3, 47.6, -122.3)).toBe(0);
  });

  it("turns miles into StageTime's drive and bus minutes", () => {
    expect(estimateOpenMicDriveMinutes(10)).toBe(30);
    expect(estimateOpenMicDriveMinutes(0)).toBe(0);
    expect(estimateOpenMicTransitMinutes(0)).toBe(10);
    expect(estimateOpenMicTransitMinutes(10)).toBe(73);
  });

  it("needs both a location and the venue's coordinates", () => {
    const withCoords = mic({ name: "A", latitude: 47.5501, longitude: -122.3279 });
    expect(getOpenMicTravelEstimate(withCoords, null)).toBeNull();
    expect(getOpenMicTravelEstimate(mic({ name: "B" }), CAPITOL_HILL)).toBeNull();
    const estimate = getOpenMicTravelEstimate(withCoords, CAPITOL_HILL);
    expect(estimate?.distanceMiles).toBeCloseTo(4.9, 1);
    expect(estimate?.driveMinutes).toBe(15);
  });

  it("names the traffic by drive time", () => {
    expect(getTripTrafficCondition(20).label).toBe("Clear");
    expect(getTripTrafficCondition(21).label).toBe("Moderate");
    expect(getTripTrafficCondition(36)).toEqual({ label: "Heavy", className: "text-red-400" });
  });

  it("reads Open-Meteo weather codes", () => {
    expect(getWeatherCondition(0)).toEqual({ emoji: "☀️", label: "Clear" });
    expect(getWeatherCondition(3).label).toBe("Partly cloudy");
    expect(getWeatherCondition(63).label).toBe("Rain");
    expect(getWeatherCondition(1234).label).toBe("Conditions unavailable");
  });

  it("sums up mapped parking", () => {
    expect(summarizeNearbyParking([])).toEqual({ summary: "Street and nearby neighborhood parking available.", huntMinutes: 10 });
    expect(summarizeNearbyParking([{ tags: { fee: "no" } }, { tags: {} }])).toEqual({
      summary: "2 mapped parking options within 300 m. Free parking is mapped nearby.",
      huntMinutes: 6,
    });
    expect(summarizeNearbyParking([{ tags: { fee: "yes" } }]).summary).toBe(
      "1 mapped parking option within 300 m. Paid parking or meters are mapped nearby."
    );
    expect(summarizeNearbyParking([{}, {}, {}, {}]).huntMinutes).toBe(4);
  });
});

describe("buildTripReminder", () => {
  const slims = mic({ id: "slim's", name: "Slim's", location: "5606 1st Ave S", timeSignupStart: "5:30pm/6pm" });
  const monday = new Date("2026-09-28T20:00:00Z");
  const now = new Date("2026-09-29T05:42:00Z");

  it("reminds the viewer to leave, driving and parking time before sign-up, in Seattle time", () => {
    const reminder = buildTripReminder(slims, 20, monday, now);
    expect(reminder?.fileName).toBe("leave-for-slim-s.ics");
    expect(reminder?.leaveAtLabel).toBe("5:10 PM");
    expect(reminder?.ics).toContain("DTSTART;TZID=America/Los_Angeles:20260928T171000\r\n");
    expect(reminder?.ics).toContain("DTEND;TZID=America/Los_Angeles:20260928T172500\r\n");
    expect(reminder?.ics).toContain("SUMMARY:Leave now for Slim's\r\n");
    expect(reminder?.ics).toContain("DESCRIPTION:Allow 20 minutes for driving and parking before 5:30 PM sign-up.\r\n");
    expect(reminder?.ics).toContain("DTSTAMP:20260929T054200Z\r\n");
  });

  it("escapes calendar text and needs a time", () => {
    expect(buildTripReminder(mic({ name: "A, B; C", location: "1 Main St" }), 10, monday, now)).toBeNull();
    const reminder = buildTripReminder({ ...slims, address: "1 Main St, Seattle" }, 10, monday, now);
    expect(reminder?.ics).toContain("LOCATION:1 Main St\\, Seattle\r\n");
  });
});
