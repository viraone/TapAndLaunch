import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SignupHeader, SignupStatusPill } from "./OpenMicSignupRuntime";

describe("SignupStatusPill", () => {
  it("open: green pill with the short wording", () => {
    const html = renderToStaticMarkup(createElement(SignupStatusPill, { open: true, closesAt: "Thu 11:00 PM", reopenText: "" }));
    expect(html).toContain("Sign-up open · closes Thu 11 PM");
    expect(html).toContain("emerald");
    expect(html).toContain('role="status"');
  });

  it("closed: amber pill", () => {
    const html = renderToStaticMarkup(createElement(SignupStatusPill, { open: false, closesAt: "", reopenText: "Fri 9:40 PM" }));
    expect(html).toContain("Sign Ups Are Closed: Reopens Fri 9:40 PM.");
    expect(html).toContain("amber");
  });

  it("closed with closedText: shows the replacement text", () => {
    const html = renderToStaticMarkup(createElement(SignupStatusPill, { open: false, closesAt: "", reopenText: "Saturday 11/28", closedText: "Sign-ups for the 12/04 open mic open Saturday 11/28." }));
    expect(html).toContain("Sign-ups for the 12/04 open mic open Saturday 11/28.");
    expect(html).not.toContain("Sign Ups Are Closed");
  });

  it("SignupHeader shows the pill unless pillBelow", () => {
    const base = { config: {} as never, showDate: "Friday, Nov 20", open: true, hidePill: false, reopenText: "", closesAt: "Thu 11:00 PM" };
    const html = renderToStaticMarkup(createElement(SignupHeader, base));
    expect(html).toContain("Sign-up open");
    const belowHtml = renderToStaticMarkup(createElement(SignupHeader, { ...base, pillBelow: true }));
    expect(belowHtml).not.toContain("Sign-up open");
  });
});

