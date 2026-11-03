import { describe, expect, it } from "vitest";
import { appleTouchIconHref } from "./apple-touch-icon";

describe("appleTouchIconHref", () => {
  it("uses the uploaded icon when the manifest has one", () => {
    expect(appleTouchIconHref("https://cdn.example.com/icon.png")).toBe("https://cdn.example.com/icon.png");
    expect(appleTouchIconHref("/uploads/icon.png")).toBe("/uploads/icon.png");
  });

  it("falls back to the generated letter tile when there is no icon", () => {
    expect(appleTouchIconHref(null)).toBe("/app-icon?size=180");
    expect(appleTouchIconHref(undefined)).toBe("/app-icon?size=180");
  });
});
