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
    expect(out).toContain("Everyone");
    expect(out).toContain("Tap to pick one comic instead");
    expect(out).toContain("border-sky-400/70");
    expect(out).toContain("text-[24px]");
    expect(out).toContain("Set length");
    expect(out).toContain("3<span");
    expect(out).toContain("From the sheet");
    expect(out).toContain("Karen");
    expect(out).toContain("Test Jones 1");
    expect(out).toContain(">7 min<");
    expect(out).not.toContain("Reset everyone to the sheet");
  });

  it("allMinutes set with overrides", () => {
    const out = html({ allMinutes: 4, hasOverrides: true });
    expect(out).toContain("4<span");
    expect(out).toContain("Set by the hosts tonight");
    expect(out).not.toContain("Reset everyone to the sheet"); // hidden for now: SHOW_RESET_EVERYONE is false in CompSetPicker.tsx
  });

  it("selected custom comic", () => {
    const out = html({ selected: "test jones 1" });
    expect(out).toContain("Just Test · everyone else 3 min");
    expect(out).toContain("Put Test back to 3 min");
    expect(out).not.toContain("Same as everyone");
    expect(html({ selected: "test jones 1", defaultOpen: true })).toContain('aria-selected="true"');
    expect(out).toContain("Tap to pick someone else");
    expect(out).toContain("7<span");
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

  it("shows a hint instead of a button until the number changes", () => {
    expect(html()).toContain("Tap − or + to change");
    expect(html()).not.toContain("No change yet");
    expect(html({ selected: "karen" })).toContain("Tap − or + to change");
  });

  it("counts the comics the hosts changed, next to the sheet's number", () => {
    const out = html({ hasOverrides: true });
    expect(out).toContain("Sheet says 3 min · 1 comic changed");
  });

  it("marks a comic with their own number in the list", () => {
    const out = html({ defaultOpen: true });
    expect(out).toMatch(/border-white\/80[^>]*>7 min</);
    expect(out).not.toMatch(/border-white\/80[^>]*>3 min</);
  });

  it("puts a comic back to their own base number when one is given", () => {
    const out = html({ selected: "test jones 1", targets: [{ key: "test jones 1", name: "Test Jones 1", minutes: 7, custom: true, base: 5 }] });
    expect(out).toContain("Put Test back to 5 min");
    expect(out).toContain("Just Test · everyone else 3 min");
  });

  it("has no row of quick lengths", () => {
    const out = html();
    expect(out).not.toContain("Quick lengths");
  });
});
