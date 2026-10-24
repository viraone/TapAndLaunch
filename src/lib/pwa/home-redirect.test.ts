import { describe, expect, it } from "vitest";
import { homeRedirectScript, homeRedirectTarget } from "./home-redirect";

const halloween = "https://stagetimepnw.com/halloween";

describe("homeRedirectTarget", () => {
  it("is off with no key, a blank key or a non-http address", () => {
    expect(homeRedirectTarget(undefined)).toBeNull();
    expect(homeRedirectTarget({})).toBeNull();
    expect(homeRedirectTarget({ home_redirect: "" })).toBeNull();
    expect(homeRedirectTarget({ home_redirect: "javascript:alert(1)" })).toBeNull();
    expect(homeRedirectTarget({ home_redirect: "/profile" })).toBeNull();
  });

  it("redirects with no end time, until the key is removed", () => {
    expect(homeRedirectTarget({ home_redirect: halloween }, new Date("2030-01-01T00:00:00Z"))).toBe(halloween);
  });

  it("redirects before the end time and shows the page from the end time on", () => {
    const theme = { home_redirect: halloween, home_redirect_until: "2026-10-29T23:00:00-07:00" };
    expect(homeRedirectTarget(theme, new Date("2026-10-29T22:59:00-07:00"))).toBe(halloween);
    expect(homeRedirectTarget(theme, new Date("2026-10-29T23:00:00-07:00"))).toBeNull();
    expect(homeRedirectTarget(theme, new Date("2026-10-30T12:00:00-07:00"))).toBeNull();
  });

  it("an unreadable end time means no redirect, so a typo never locks the app away", () => {
    expect(homeRedirectTarget({ home_redirect: halloween, home_redirect_until: "next thursday" })).toBeNull();
  });

  it("a browser with the named tab switch on (a host's phone) is never redirected", () => {
    const theme = { home_redirect: halloween, home_redirect_unless: "openmic-hosts" };
    expect(homeRedirectTarget(theme, new Date(), (key) => key === "openmic-hosts")).toBeNull();
    expect(homeRedirectTarget(theme, new Date(), () => false)).toBe(halloween);
    expect(homeRedirectTarget(theme, new Date(), (key) => key === "openmic-comic")).toBe(halloween);
  });

  it("the in-page script leaves a browser with the switch on alone and sends the rest away", () => {
    const script = homeRedirectScript(halloween, "openmic-hosts");
    expect(script).toContain('localStorage.getItem("tl-nav-flag:openmic-hosts")==="1"');
    expect(script).toContain('location.replace("https://stagetimepnw.com/halloween")');
    expect(homeRedirectScript(halloween, undefined)).toBe('location.replace("https://stagetimepnw.com/halloween");');
  });

  it("with a notice, the script hides the page for the notice instead of leaving", () => {
    const script = homeRedirectScript(halloween, "openmic-hosts", true);
    expect(script).toContain('localStorage.getItem("tl-nav-flag:openmic-hosts")==="1"');
    expect(script).toContain('s.id="tl-home-redirect"');
    expect(script).toContain("body{visibility:hidden}");
    expect(script).not.toContain("location.replace");
  });
});
