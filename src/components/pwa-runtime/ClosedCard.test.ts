import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClosedCard } from "./OpenMicSignupRuntime";

describe("ClosedCard", () => {
  it("default: the closed heading and the first name with the reopening text", () => {
    const html = renderToStaticMarkup(createElement(ClosedCard, { name: "Sam Rivera", reopenText: "Saturday 11/28" }));
    expect(html).toContain("Requests are closed for this week");
    expect(html).toContain("Sam, requests open again Saturday 11/28.");
    expect(html).not.toContain("text-primary");
  });

  it("with its own texts: shows the pill, the heading and the note instead", () => {
    const html = renderToStaticMarkup(createElement(ClosedCard, { name: "Sam Rivera", reopenText: "Saturday 11/28", pill: "Free Show This Friday", heading: "No open mic this Friday", note: "Come out for Thanksgiving Leftovers." }));
    expect(html).toContain("Free Show This Friday");
    expect(html).toContain("No open mic this Friday");
    expect(html).toContain("Come out for Thanksgiving Leftovers.");
    expect(html).not.toContain("Requests are closed for this week");
    expect(html).not.toContain("requests open again");
  });

  it("an empty heading or pill falls back to the default card", () => {
    const html = renderToStaticMarkup(createElement(ClosedCard, { name: "", reopenText: "Saturday 11/28", pill: "", heading: "" }));
    expect(html).toContain("Requests are closed for this week");
    expect(html).toContain("Requests open again Saturday 11/28.");
    expect(html).not.toContain("text-primary");
  });
});
