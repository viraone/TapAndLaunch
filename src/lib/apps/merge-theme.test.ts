import { describe, expect, it } from "vitest";
import { mergeThemeUpdate } from "./merge-theme";

const DECLARED = ["primary_color", "font_family"] as const;

describe("mergeThemeUpdate", () => {
  it("keeps keys the schema does not declare", () => {
    const current = {
      primary_color: "#ffffff",
      header_action: { label: "Profile", icon: "user", page_path: "profile" },
      home_redirect: "https://stagetimepnw.com/halloween",
      home_redirect_until: "2026-11-02T00:00:00-07:00",
    };

    const merged = mergeThemeUpdate(current, { primary_color: "#000000" }, DECLARED);

    expect(merged.header_action).toEqual(current.header_action);
    expect(merged.home_redirect).toBe("https://stagetimepnw.com/halloween");
    expect(merged.home_redirect_until).toBe("2026-11-02T00:00:00-07:00");
  });

  it("lets an incoming value override a declared key", () => {
    const merged = mergeThemeUpdate({ primary_color: "#ffffff" }, { primary_color: "#000000" }, DECLARED);

    expect(merged.primary_color).toBe("#000000");
  });

  it("removes a declared key that incoming leaves out", () => {
    const merged = mergeThemeUpdate(
      { primary_color: "#ffffff", font_family: "serif", home_redirect: "/party" },
      { primary_color: "#000000" },
      DECLARED
    );

    expect(merged).not.toHaveProperty("font_family");
    expect(merged.home_redirect).toBe("/party");
  });

  it("treats a null or undefined current theme as empty", () => {
    const incoming = { primary_color: "#000000" };

    expect(mergeThemeUpdate(null, incoming, DECLARED)).toEqual(incoming);
    expect(mergeThemeUpdate(undefined, incoming, DECLARED)).toEqual(incoming);
  });

  it("does not mutate its inputs", () => {
    const current = {
      primary_color: "#ffffff",
      font_family: "serif",
      header_action: { label: "Profile", icon: "user", page_path: "profile" },
    };
    const incoming = { primary_color: "#000000" };
    const currentBefore = structuredClone(current);
    const incomingBefore = structuredClone(incoming);

    mergeThemeUpdate(current, incoming, DECLARED);

    expect(current).toEqual(currentBefore);
    expect(incoming).toEqual(incomingBefore);
  });
});
