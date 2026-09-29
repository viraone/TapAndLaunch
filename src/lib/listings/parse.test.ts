import { describe, expect, it } from "vitest";
import {
  classifyOpenMicCategory,
  isOpenMicDayActive,
  normalizeOpenMicContact,
  parseSignupStartTimes,
  parseTimeStringToMinutes,
} from "@/lib/listings/parse";

describe("isOpenMicDayActive", () => {
  it("treats leading-y values as active and everything else inactive", () => {
    expect(isOpenMicDayActive("Yes")).toBe(true);
    expect(isOpenMicDayActive("yes ")).toBe(true);
    expect(isOpenMicDayActive("no")).toBe(false);
    expect(isOpenMicDayActive("REQ. ->")).toBe(false);
    expect(isOpenMicDayActive("")).toBe(false);
  });
});

describe("parseTimeStringToMinutes", () => {
  it("parses am/pm and military times, rejecting out-of-range values", () => {
    expect(parseTimeStringToMinutes("7pm")).toBe(1140);
    expect(parseTimeStringToMinutes("7:30pm")).toBe(1170);
    expect(parseTimeStringToMinutes("12am")).toBe(0);
    expect(parseTimeStringToMinutes("12pm")).toBe(720);
    expect(parseTimeStringToMinutes("6:00 PM")).toBe(1080);
    expect(parseTimeStringToMinutes("19:30")).toBe(1170);
    expect(parseTimeStringToMinutes("24:00")).toBeNull();
    expect(parseTimeStringToMinutes("8")).toBeNull();
    expect(parseTimeStringToMinutes("")).toBeNull();
  });
});

describe("parseSignupStartTimes", () => {
  it("splits signup/start on the first slash and falls back to signup for start", () => {
    expect(parseSignupStartTimes("6pm/6:30pm-8pm")).toEqual({
      signupMinutes: 1080,
      startMinutes: 1110,
    });
    expect(parseSignupStartTimes("/8pm")).toEqual({ signupMinutes: null, startMinutes: 1200 });
    expect(parseSignupStartTimes("6pm/")).toEqual({ signupMinutes: 1080, startMinutes: 1080 });
    expect(parseSignupStartTimes("Online/7pm-9pm")).toEqual({
      signupMinutes: null,
      startMinutes: 1140,
    });
    // Reads as 10 PM, matching the live site; kept intentionally.
    expect(parseSignupStartTimes("/7-10pm")).toEqual({ signupMinutes: null, startMinutes: 1320 });
    expect(parseSignupStartTimes("/6pm-12am")).toEqual({ signupMinutes: null, startMinutes: 1080 });
    expect(parseSignupStartTimes("6:00 PM")).toEqual({ signupMinutes: null, startMinutes: 1080 });
    expect(parseSignupStartTimes("")).toEqual({ signupMinutes: null, startMinutes: null });
  });
});

describe("normalizeOpenMicContact", () => {
  it("passes http(s) links through as Contact links", () => {
    const url = "https://www.instagram.com/stonedgooseproductions/";
    expect(normalizeOpenMicContact(url)).toEqual({ href: url, label: "Contact", isLink: true });
  });

  it("builds tel:+1 links for 10-digit US numbers in any formatting", () => {
    expect(normalizeOpenMicContact("(360) 239-3881")).toEqual({
      href: "tel:+13602393881",
      label: "(360) 239-3881",
      isLink: false,
    });
    expect(normalizeOpenMicContact("360-239-3881")).toEqual({
      href: "tel:+13602393881",
      label: "360-239-3881",
      isLink: false,
    });
    expect(normalizeOpenMicContact("+1 360 239 3881")).toEqual({
      href: "tel:+13602393881",
      label: "+1 360 239 3881",
      isLink: false,
    });
  });

  it("rejects non-contacts and unsafe schemes", () => {
    expect(normalizeOpenMicContact("call the bar")).toEqual({ href: "", label: "", isLink: false });
    expect(normalizeOpenMicContact("239-3881")).toEqual({ href: "", label: "", isLink: false });
    expect(normalizeOpenMicContact("javascript:alert(1)")).toEqual({
      href: "",
      label: "",
      isLink: false,
    });
    expect(normalizeOpenMicContact("")).toEqual({ href: "", label: "", isLink: false });
  });
});

describe("classifyOpenMicCategory", () => {
  it("classifies comedy-only mics as comedy and mixed-talent mics as variety", () => {
    expect(classifyOpenMicCategory("Comedy")).toBe("comedy");
    expect(classifyOpenMicCategory("Only Comedy")).toBe("comedy");
    expect(classifyOpenMicCategory("Improv Comedy")).toBe("comedy");
    expect(classifyOpenMicCategory("Mix Music Mic / Comedy")).toBe("variety");
    expect(classifyOpenMicCategory("Anything is allowed")).toBe("variety");
    expect(classifyOpenMicCategory("Variety / All Voices Welcome")).toBe("variety");
    expect(classifyOpenMicCategory("VARIETY (MUSIC, COMEDY, ETC.)")).toBe("variety");
  });

  it("returns null for empty input", () => {
    expect(classifyOpenMicCategory("")).toBeNull();
  });
});
