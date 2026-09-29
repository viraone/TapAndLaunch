import { describe, expect, it } from "vitest";
import { getOpenMicHost, normalizeOpenMicRecord } from "@/lib/listings/record";

const FULL = {
  id: " Test-Mic ",
  name: " Test Mic ",
  venue: "The Bar",
  location: "1 Main St, Seattle, WA",
  timeSignupStart: "6:30pm/7pm-9pm",
  monday: "Yes",
  tuesday: "no",
  wednesday: "REQ. ->",
  recurrence: { type: "monthly-nth-weekday", weekday: "Monday", nth: 2 },
  recurrenceText: "2nd Monday",
  signupType: "In Person",
  signupInstructions: "Sign up at the bar",
  showWhenInactive: true,
  priceForTime: "Free",
  openMicType: "Comedy",
  ageRequirement: "21+",
  requirementsInfo: "5 min",
  signupLocationNote: "By the door",
  parkingHuntMins: "7.6",
  host: "Amy",
  hostSchedule: { "2026-10-12": "Bo", "bad-date": "X", "2026-10-19": "  " },
  wheelchairAccessible: true,
  webSignup: "N/A",
  contact: "(360) 239-3881",
  listLabel: "October list",
  listUrl: "javascript:alert(1)",
  latitude: "47.6",
  longitude: -122.3,
};

describe("normalizeOpenMicRecord", () => {
  it("normalizes a full record", () => {
    expect(normalizeOpenMicRecord(FULL)).toEqual({
      id: "Test-Mic",
      name: "Test Mic",
      venue: "The Bar",
      address: "1 Main St, Seattle, WA",
      rawTime: "6:30pm/7pm-9pm",
      signupMinutes: 1110,
      startMinutes: 1140,
      days: {
        Monday: true,
        Tuesday: false,
        Wednesday: false,
        Thursday: false,
        Friday: false,
        Saturday: false,
        Sunday: false,
      },
      recurrence: { type: "monthly-nth-weekday", weekday: "Monday", nth: 2 },
      anchorDate: "",
      recurrenceText: "2nd Monday",
      signupType: "in person",
      signupDetails: "Sign up at the bar",
      showWhenInactive: true,
      price: "Free",
      micType: "Comedy",
      ageRequirement: "21+",
      notes: "5 min",
      signupLocationNote: "By the door",
      parkingHuntMinutes: 8,
      host: "Amy",
      hostSchedule: { "2026-10-12": "Bo" },
      wheelchairAccessible: true,
      website: "",
      contact: "tel:+13602393881",
      contactLabel: "(360) 239-3881",
      contactIsLink: false,
      listLabel: "October list",
      listUrl: "",
      latitude: 47.6,
      longitude: -122.3,
    });
  });

  it("applies coordinate overrides by id", () => {
    const mic = normalizeOpenMicRecord({
      id: "spice-of-life-variety-open-mic-darren-s-speakeasy-renton-wa",
      name: "Spice",
    });
    expect(mic?.latitude).toBe(47.4797);
    expect(mic?.longitude).toBe(-122.2031);
  });

  it("rejects out-of-range coordinates and non-http urls, keeps valid website", () => {
    const mic = normalizeOpenMicRecord({
      name: "X",
      latitude: 999,
      longitude: "abc",
      webSignup: "https://a.b/c",
      recurrence: [1],
    });
    expect(mic?.latitude).toBeNull();
    expect(mic?.longitude).toBeNull();
    expect(mic?.website).toBe("https://a.b/c");
    expect(mic?.recurrence).toBeNull();
  });

  it("falls back to recurrence.startDate for anchorDate", () => {
    const mic = normalizeOpenMicRecord({ name: "X", recurrence: { type: "biweekly", startDate: "2026-01-05" } });
    expect(mic?.anchorDate).toBe("2026-01-05");
  });

  it("returns null for blank names, arrays and null", () => {
    expect(normalizeOpenMicRecord({ name: "  " })).toBeNull();
    expect(normalizeOpenMicRecord([])).toBeNull();
    expect(normalizeOpenMicRecord(null)).toBeNull();
  });
});

describe("getOpenMicHost", () => {
  const mic = normalizeOpenMicRecord(FULL);

  it("returns the scheduled host for a matching Seattle date", () => {
    expect(getOpenMicHost(mic!, new Date(Date.UTC(2026, 9, 12, 20)))).toBe("Bo");
  });

  it("falls back to the default host when no schedule entry matches", () => {
    expect(getOpenMicHost(mic!, new Date(Date.UTC(2026, 9, 19, 20)))).toBe("Amy");
  });

  it("falls back to the default host for an invalid date", () => {
    expect(getOpenMicHost(mic!, new Date(NaN))).toBe("Amy");
  });
});
