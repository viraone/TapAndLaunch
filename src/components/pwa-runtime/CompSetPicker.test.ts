import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompSetPicker, type CompTarget } from "./CompSetPicker";

const targets: CompTarget[] = [
  { key: "karen", name: "Karen", minutes: 3, custom: false },
  { key: "test jones 1", name: "Test Jones 1", minutes: 7, custom: true },
];

const html = (over: Partial<Parameters<typeof CompSetPicker>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(CompSetPicker, {
      targets,
      selected: "",
      onSelect: () => {},
      allMinutes: null,
      fallback: 3,
      hasOverrides: false,
      saving: false,
      error: null,
      onChange: () => {},
      ...over,
    })
  );

describe("CompSetPicker", () => {
  it("default: nothing dictated, all comics", () => {
    const out = html({ defaultOpen: true });
    expect(out).toContain("All comics");
    expect(out).toContain("How long is each set?");
    expect(out).toContain("3 min");
    expect(out).toContain("From the sheet");
    expect(out).toContain("Karen");
    expect(out).toContain("Test Jones 1");
    expect(out).toContain(">7 min<");
    expect(out).not.toContain("Back to the sheet");
  });

  it("allMinutes set with overrides", () => {
    const out = html({ allMinutes: 4, hasOverrides: true });
    expect(out).toContain("4 min");
    expect(out).toContain("Set by the hosts tonight");
    expect(out).toContain("Back to the sheet");
  });

  it("selected custom comic", () => {
    const out = html({ selected: "test jones 1" });
    expect(out).toContain("Just this comic");
    expect(out).toContain("Same as everyone");
    expect(html({ selected: "test jones 1", defaultOpen: true })).toContain('aria-selected="true"');
    expect(out).toContain("Test Jones 1 · 7 min");
    expect(out).toMatch(/tabular-nums text-white">7 min</);
  });

  it("selected non-custom comic shows Same as everyone once", () => {
    const out = html({ selected: "karen" });
    expect(out.split("Same as everyone").length - 1).toBe(1);
  });

  it("minus disabled at 1, plus disabled at 15", () => {
    expect(html({ allMinutes: 1 })).toMatch(/aria-label="One minute less" disabled=""/);
    expect(html({ allMinutes: 1 })).not.toMatch(/aria-label="One minute more" disabled=""/);
    expect(html({ allMinutes: 15 })).toMatch(/aria-label="One minute more" disabled=""/);
  });

  it("shows the error", () => {
    const out = html({ error: "Try again now" });
    expect(out).toContain('role="alert"');
    expect(out).toContain("Try again now");
  });

  it("the list is closed until the box is tapped", () => {
    expect(html()).not.toContain('role="listbox"');
    expect(html({ defaultOpen: true })).toContain('role="listbox"');
  });
});
