import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmailStep } from "./OpenMicSignupRuntime";

const render = (open: boolean) => renderToStaticMarkup(createElement(EmailStep, { client: null as never, email: "", setEmail: () => {}, open, onSent: () => {} }));

describe("EmailStep", () => {
  it("open: one heading and one helper line that welcomes first-timers and returners, no separate green note", () => {
    const html = render(true);
    expect(html).toContain("Request your spot");
    expect(html).toContain("First time or returning, enter your email.");
    expect(html).not.toContain("emerald");
    expect(html).toContain('aria-label="Email"');
    expect(html).toContain("Send my code");
  });

  it("closed: the sign-in heading and the plain helper line", () => {
    const html = render(false);
    expect(html).toContain("Sign in to see your status");
    expect(html).not.toContain("First time or returning");
    expect(html).toContain("Enter your email.");
  });
});
