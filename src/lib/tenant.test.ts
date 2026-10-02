import { afterEach, describe, expect, it } from "vitest";
import { extractAppSlug } from "./tenant";

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
