import { describe, expect, it } from "vitest";
import { WebPageBlockConfigSchema } from "./block-config";

describe("web_page block config", () => {
  it("accepts an https address with the other fields", () => {
    expect(
      WebPageBlockConfigSchema.safeParse({
        url: "https://example.com",
        title: "Example",
        allow_location: true,
        height: "tall",
      }).success
    ).toBe(true);
  });

  it("accepts an empty address (the block starts blank)", () => {
    expect(WebPageBlockConfigSchema.safeParse({ url: "" }).success).toBe(true);
  });

  it("rejects http addresses and things that are not addresses", () => {
    for (const url of ["http://example.com", "example.com", "javascript:alert(1)"]) {
      expect(WebPageBlockConfigSchema.safeParse({ url }).success, url).toBe(false);
    }
  });

  it("rejects a height it does not know", () => {
    expect(WebPageBlockConfigSchema.safeParse({ url: "https://example.com", height: "huge" }).success).toBe(false);
  });
});
