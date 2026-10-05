import { describe, expect, it } from "vitest";
import { appLiveUrl } from "./share";

describe("appLiveUrl", () => {
  it("uses the subdomain by default", () => {
    expect(appLiveUrl({ slug: "gym", custom_domain: null, custom_domain_status: null }, "tapandlaunch.com")).toBe("https://gym.tapandlaunch.com");
  });
  it("uses a custom domain only once it is verified", () => {
    expect(appLiveUrl({ slug: "gym", custom_domain: "gym.com", custom_domain_status: "pending" }, "tapandlaunch.com")).toBe("https://gym.tapandlaunch.com");
    expect(appLiveUrl({ slug: "gym", custom_domain: "gym.com", custom_domain_status: "verified" }, "tapandlaunch.com")).toBe("https://gym.com");
  });
  it("uses http for a local root domain", () => {
    expect(appLiveUrl({ slug: "gym", custom_domain: null, custom_domain_status: null }, "localhost:3100")).toBe("http://gym.localhost:3100");
  });
});
