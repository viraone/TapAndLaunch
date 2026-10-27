import { describe, expect, it } from "vitest";
import { allowRun, finish, hashVisitor, latestWithinCooldown, tryStart } from "./limits";

const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);

describe("allowRun", () => {
  it("allows three runs in ten minutes, then refuses the fourth", () => {
    const address = "allowRun:window";
    expect(allowRun(address, t0)).toBe(true);
    expect(allowRun(address, t0 + 1000)).toBe(true);
    expect(allowRun(address, t0 + 2000)).toBe(true);
    expect(allowRun(address, t0 + 3000)).toBe(false);
  });

  it("allows again once the ten-minute window passes", () => {
    const address = "allowRun:expire";
    expect(allowRun(address, t0)).toBe(true);
    expect(allowRun(address, t0 + 1)).toBe(true);
    expect(allowRun(address, t0 + 2)).toBe(true);
    expect(allowRun(address, t0 + 10 * 60_000 + 1)).toBe(true);
  });

  it("respects an injected max", () => {
    const address = "allowRun:max";
    expect(allowRun(address, t0, 1)).toBe(true);
    expect(allowRun(address, t0 + 1, 1)).toBe(false);
  });
});

describe("tryStart / finish", () => {
  it("holds at most two concurrent checks", () => {
    expect(tryStart(2)).toBe(true);
    expect(tryStart(2)).toBe(true);
    expect(tryStart(2)).toBe(false);
    finish();
    expect(tryStart(2)).toBe(true);
    finish();
    finish();
  });

  it("never lets finish drop the count below zero", () => {
    finish();
    finish();
    expect(tryStart(1)).toBe(true);
    finish();
  });
});

describe("latestWithinCooldown", () => {
  it("returns the newest timestamp still inside the window", () => {
    const now = 1_000_000;
    expect(latestWithinCooldown([now - 5, now - 20, now - 61], now, 60)).toBe(now - 5);
  });

  it("returns null when nothing is recent enough", () => {
    const now = 1_000_000;
    expect(latestWithinCooldown([now - 61, now - 100], now, 60)).toBeNull();
  });
});

describe("hashVisitor", () => {
  it("is a stable hex hash that never stores the raw address", () => {
    const h = hashVisitor("1.2.3.4");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashVisitor("1.2.3.4"));
    expect(h).not.toContain("1.2.3.4");
  });
});
