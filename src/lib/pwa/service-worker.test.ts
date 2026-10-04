import { describe, expect, it } from "vitest";
import { buildServiceWorkerScript, deployId } from "@/lib/pwa/service-worker";
import { decideOnControllerChange, MIN_RELOAD_GAP_MS } from "@/lib/pwa/sw-update";

describe("deployId / the service worker text", () => {
  it("uses the git commit, then the deployment id, then 'dev', shortened", () => {
    expect(deployId({ VERCEL_GIT_COMMIT_SHA: "0123456789abcdef", VERCEL_DEPLOYMENT_ID: "dpl_x" })).toBe("0123456789ab");
    expect(deployId({ VERCEL_DEPLOYMENT_ID: "dpl_abc" })).toBe("dpl_abc");
    expect(deployId({})).toBe("dev");
  });

  it("is different on every deploy (browsers only update a worker whose text changed)", () => {
    expect(buildServiceWorkerScript("livebitesnow", "aaa")).not.toBe(buildServiceWorkerScript("livebitesnow", "bbb"));
    expect(buildServiceWorkerScript("livebitesnow", "aaa")).toBe(buildServiceWorkerScript("livebitesnow", "aaa"));
  });

  it("names the cache after the app and the deploy, and deletes older caches on activate", () => {
    const script = buildServiceWorkerScript("livebitesnow", "abc123");
    expect(script).toContain('const CACHE_NAME = "beezer-app-livebitesnow-abc123"');
    expect(script).toMatch(/keys\.filter\(\(key\) => key !== CACHE_NAME\)/);
  });

  it("is valid JavaScript", () => {
    expect(() => new Function(buildServiceWorkerScript("livebitesnow", "abc123"))).not.toThrow();
  });

  it("caches only the hashed /_next/static/ files cache-first; pages and everything else go to the network first", () => {
    const script = buildServiceWorkerScript("a", "b");
    expect(script).toContain('url.pathname.startsWith("/_next/static/")');
    expect(script).toContain("networkFirst(event.request, OFFLINE_URL)");
    expect(script).toContain("event.respondWith(networkFirst(event.request));");
    expect(script).toContain('addEventListener("notificationclick"'); // push handling is kept
    expect(script).toContain('addEventListener("push"');
  });
});

describe("decideOnControllerChange", () => {
  const base = { hadController: true, typing: false, lastReloadAt: 0, now: 1_000_000 };
  it("ignores the first-ever install (nothing to refresh)", () => {
    expect(decideOnControllerChange({ ...base, hadController: false })).toBe("ignore");
  });
  it("reloads when a new version takes over an open page", () => {
    expect(decideOnControllerChange(base)).toBe("reload");
  });
  it("waits instead of reloading while the person is typing", () => {
    expect(decideOnControllerChange({ ...base, typing: true })).toBe("wait");
  });
  it("never reloads twice within the minimum gap", () => {
    expect(decideOnControllerChange({ ...base, lastReloadAt: base.now - MIN_RELOAD_GAP_MS + 1 })).toBe("ignore");
    expect(decideOnControllerChange({ ...base, lastReloadAt: base.now - MIN_RELOAD_GAP_MS - 1 })).toBe("reload");
  });
});
