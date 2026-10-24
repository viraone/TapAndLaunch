import { describe, expect, it } from "vitest";
import { nameKey, pushSupport, upNextPayload, upNextStatus, vapidKeyBytes } from "./push";

describe("nameKey", () => {
  it("ignores case, surrounding space and runs of spaces", () => {
    expect(nameKey("  BLAKE   Kiltoff ")).toBe("blake kiltoff");
    expect(nameKey("Phillip Keller")).toBe(nameKey("phillip  keller"));
  });
  it("keeps different names apart", () => {
    expect(nameKey("Rich Snyder")).not.toBe(nameKey("Rich Snyder Jr"));
  });
});

describe("upNextPayload", () => {
  it("names the show and opens the Sign-Up tab", () => {
    expect(upNextPayload("Read The Room")).toEqual({ title: "You're up next!", body: "Read The Room: head to the stage area.", url: "/" });
  });
  it("falls back when the block has no show name", () => {
    expect(upNextPayload(undefined).body).toBe("The show: head to the stage area.");
    expect(upNextPayload("  ").body).toBe("The show: head to the stage area.");
  });
});

describe("pushSupport", () => {
  const ua = { iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", android: "Mozilla/5.0 (Linux; Android 14) Chrome/120" };
  it("is ok when the browser has a service worker, push and notifications", () => {
    expect(pushSupport({ serviceWorker: true, pushManager: true, notification: true, userAgent: ua.android, standalone: false })).toBe("ok");
  });
  it("tells an iPhone in Safari to add the app to the Home Screen first", () => {
    expect(pushSupport({ serviceWorker: true, pushManager: false, notification: false, userAgent: ua.iphone, standalone: false })).toBe("ios-not-installed");
  });
  it("is unsupported on an old Home Screen app or a browser without push", () => {
    expect(pushSupport({ serviceWorker: true, pushManager: false, notification: false, userAgent: ua.iphone, standalone: true })).toBe("unsupported");
    expect(pushSupport({ serviceWorker: false, pushManager: false, notification: false, userAgent: ua.android, standalone: false })).toBe("unsupported");
  });
});

describe("upNextStatus", () => {
  it("says whose phone buzzed, who has no phone subscribed, and when the send failed", () => {
    expect(upNextStatus("Phillip Keller", { sent: 1, matched: 1 })).toBe("Buzzed Phillip Keller's phone.");
    expect(upNextStatus("Phillip Keller", { sent: 0, matched: 0 })).toBe("Phillip Keller hasn't turned on notifications on a phone.");
    expect(upNextStatus("Phillip Keller", null)).toBe("Couldn't reach Phillip Keller's phone this time.");
  });
});

describe("vapidKeyBytes", () => {
  it("decodes URL-safe base64 without padding", () => {
    expect(Array.from(vapidKeyBytes("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(vapidKeyBytes("_-8"))).toEqual([255, 239]);
  });
});
