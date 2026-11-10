import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompSetLength } from "./CompSetLength";

const html = (over: Partial<Parameters<typeof CompSetLength>[0]> = {}) =>
  renderToStaticMarkup(createElement(CompSetLength, { minutes: null, fallback: 3, saving: false, error: null, onChange: () => {}, ...over }));

describe("CompSetLength", () => {
  it("shows the fallback and the sheet state when nothing is dictated", () => {
    const out = html();
    expect(out).toContain("3 min");
    expect(out).toContain("From the sheet");
    expect(out).not.toContain("Back to the sheet");
  });

  it("shows the dictated minutes and the back link when set", () => {
    const out = html({ minutes: 4 });
    expect(out).toContain("4 min");
    expect(out).toContain("Set by the hosts tonight");
    expect(out).toContain("Back to the sheet");
  });

  it("disables the minus at the minimum", () => {
    const out = html({ minutes: 1 });
    expect(out).toMatch(/aria-label="One minute less" disabled=""/);
    expect(out).not.toMatch(/aria-label="One minute more" disabled=""/);
  });

  it("disables the plus at the maximum", () => {
    const out = html({ minutes: 15 });
    expect(out).toMatch(/aria-label="One minute more" disabled=""/);
  });

  it("shows the error message", () => {
    const out = html({ error: "Try again now" });
    expect(out).toContain('role="alert"');
    expect(out).toContain("Try again now");
  });
});
