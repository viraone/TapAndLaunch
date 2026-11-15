import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SavedFlash } from "./SavedFlash";

describe("SavedFlash", () => {
  it("shows the message in a centered status card", () => {
    const out = renderToStaticMarkup(createElement(SavedFlash, { message: "Set Karen to 4 min", onDone: () => {} }));
    expect(out).toContain("Set Karen to 4 min");
    expect(out).toContain('role="status"');
    expect(out).toContain("items-center justify-center");
    expect(out).toContain("fixed inset-0");
  });
});
