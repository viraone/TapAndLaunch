import { afterEach, describe, expect, it } from "vitest";
import { extractAppSlug, wwwRedirectTarget } from "./tenant";

describe("opening an app by IP address (local development only)", () => {
  afterEach(() => {
    delete process.env.DEV_APP_SLUG;
  });

  it("maps a plain IP to the chosen app when DEV_APP_SLUG is set", () => {
    process.env.DEV_APP_SLUG = "stagetimepnw";
    expect(extractAppSlug("10.0.0.149:3101")).toBe("stagetimepnw");
  });

  it("does nothing without DEV_APP_SLUG, and ignores real host names", () => {
    expect(extractAppSlug("10.0.0.149:3101")).toBeNull();
    process.env.DEV_APP_SLUG = "stagetimepnw";
    expect(extractAppSlug("example.com")).toBeNull();
  });
});

describe("the separate domain for AI-written apps", () => {
  const before = { root: process.env.NEXT_PUBLIC_ROOT_DOMAIN, code: process.env.NEXT_PUBLIC_CODE_APPS_DOMAIN };
  afterEach(() => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = before.root;
    if (before.code === undefined) delete process.env.NEXT_PUBLIC_CODE_APPS_DOMAIN;
    else process.env.NEXT_PUBLIC_CODE_APPS_DOMAIN = before.code;
  });

  it("changes nothing until it's set up", async () => {
    const { extractAppSlug, hostRoot, rootDomainFor, getCodeAppsDomain } = await import("./tenant");
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "tapandlaunch.com";
    delete process.env.NEXT_PUBLIC_CODE_APPS_DOMAIN;
    expect(getCodeAppsDomain()).toBeNull();
    expect(extractAppSlug("gym.tapandlaunch.com")).toBe("gym");
    expect(extractAppSlug("gym.tapandlaunch.app")).toBeNull();
    expect(rootDomainFor("code")).toBe("tapandlaunch.com");
    expect(hostRoot("gym.tapandlaunch.com")).toBe("main");
  });

  it("serves apps from both domains and says which one a host is under", async () => {
    const { extractAppSlug, hostRoot, rootDomainFor } = await import("./tenant");
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "tapandlaunch.com";
    process.env.NEXT_PUBLIC_CODE_APPS_DOMAIN = "TapAndLaunch.app";
    expect(extractAppSlug("gym.tapandlaunch.com")).toBe("gym");
    expect(extractAppSlug("paws.tapandlaunch.app")).toBe("paws");
    expect(extractAppSlug("tapandlaunch.app")).toBeNull();
    expect(extractAppSlug("a.b.tapandlaunch.app")).toBeNull();
    expect(hostRoot("paws.tapandlaunch.app")).toBe("code");
    expect(hostRoot("gym.tapandlaunch.com")).toBe("main");
    expect(hostRoot("app.theirbrand.com")).toBeNull();
    expect(rootDomainFor("code")).toBe("tapandlaunch.app");
    expect(rootDomainFor("blocks")).toBe("tapandlaunch.com");
  });

  it("works locally when the AI-apps domain sits under the main one", async () => {
    const { extractAppSlug, hostRoot } = await import("./tenant");
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "localhost:3100";
    process.env.NEXT_PUBLIC_CODE_APPS_DOMAIN = "apps.localhost:3100";
    expect(extractAppSlug("paws.apps.localhost:3100")).toBe("paws");
    expect(extractAppSlug("gym.localhost:3100")).toBe("gym");
    expect(extractAppSlug("apps.localhost:3100")).toBeNull();
    expect(hostRoot("paws.apps.localhost:3100")).toBe("code");
    expect(hostRoot("gym.localhost:3100")).toBe("main");
  });

  it("links AI-written apps to their domain and refuses it as a customer's own domain", async () => {
    const { appLiveUrl } = await import("./apps/share");
    const { validateCustomDomain } = await import("./domains/validate");
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "tapandlaunch.com";
    process.env.NEXT_PUBLIC_CODE_APPS_DOMAIN = "tapandlaunch.app";
    expect(appLiveUrl({ slug: "paws", custom_domain: null, custom_domain_status: null, kind: "code" }, "tapandlaunch.com")).toBe("https://paws.tapandlaunch.app");
    expect(appLiveUrl({ slug: "gym", custom_domain: null, custom_domain_status: null, kind: "blocks" }, "tapandlaunch.com")).toBe("https://gym.tapandlaunch.com");
    expect(validateCustomDomain("shop.tapandlaunch.app")).toMatch(/Can't use tapandlaunch.app/);
    expect(validateCustomDomain("tapandlaunch.com")).toMatch(/Can't use tapandlaunch.com/);
  });
});

describe("www goes to the bare domain", () => {
  const before = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  afterEach(() => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = before;
  });

  it("sends www to the same path on the bare domain, keeping the query", () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "tapandlaunch.com";
    expect(wwwRedirectTarget("www.tapandlaunch.com", "/pricing", "?a=1")).toBe("https://tapandlaunch.com/pricing?a=1");
    expect(wwwRedirectTarget("WWW.TapAndLaunch.com", "/", "")).toBe("https://tapandlaunch.com/");
  });

  it("leaves the bare domain, apps and custom domains alone", () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "tapandlaunch.com";
    expect(wwwRedirectTarget("tapandlaunch.com", "/", "")).toBeNull();
    expect(wwwRedirectTarget("davidbabu.tapandlaunch.com", "/", "")).toBeNull();
    expect(wwwRedirectTarget("www.davidbabucomedy.com", "/", "")).toBeNull();
    expect(wwwRedirectTarget(null, "/", "")).toBeNull();
  });

  it("does nothing in local development", () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "localhost:3100";
    expect(wwwRedirectTarget("www.localhost:3100", "/", "")).toBeNull();
  });
});
