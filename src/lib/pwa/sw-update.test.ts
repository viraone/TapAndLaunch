import { describe, expect, it } from "vitest";
import { decideOnControllerChange, decideOnLiveDeploy, deployFromWorkerText } from "@/lib/pwa/sw-update";

describe("deployFromWorkerText", () => {
  it("reads the deploy off the first line of the worker file", () => {
    expect(deployFromWorkerText("// deploy fe9fb66050f5\nconst CACHE_NAME = 'x';")).toBe("fe9fb66050f5");
    expect(deployFromWorkerText("<html>not a worker</html>")).toBeNull();
    expect(deployFromWorkerText("")).toBeNull();
  });
});

describe("decideOnLiveDeploy", () => {
  const base = { pageDeploy: "aaa", liveDeploy: "bbb", typing: false, lastReloadAt: 0, now: 1_000_000 };
  it("reloads when a newer deploy is live", () => expect(decideOnLiveDeploy(base)).toBe("reload"));
  it("does nothing when the page is current", () => expect(decideOnLiveDeploy({ ...base, liveDeploy: "aaa" })).toBe("ignore"));
  it("does nothing when the live deploy can't be read", () => expect(decideOnLiveDeploy({ ...base, liveDeploy: null })).toBe("ignore"));
  it("does nothing in development", () => expect(decideOnLiveDeploy({ ...base, pageDeploy: "dev" })).toBe("ignore"));
  it("waits while someone is typing", () => expect(decideOnLiveDeploy({ ...base, typing: true })).toBe("wait"));
  it("never reloads twice within 30 seconds", () => expect(decideOnLiveDeploy({ ...base, lastReloadAt: base.now - 5_000 })).toBe("ignore"));
});

describe("decideOnControllerChange", () => {
  it("still ignores a first install", () => expect(decideOnControllerChange({ hadController: false, typing: false, lastReloadAt: 0, now: 1_000_000 })).toBe("ignore"));
});
