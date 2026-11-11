import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CodeStep } from "./OpenMicSignupRuntime";

function render(): string {
  return renderToStaticMarkup(
    createElement(CodeStep, { client: null as never, email: "you@example.com", onBack: () => {}, onVerified: () => {}, autoFocus: false })
  );
}

describe("CodeStep", () => {
  it("shows the heading, the address, the code box and both links", () => {
    const html = render();
    expect(html).toContain("Check your email");
    expect(html).toContain("you@example.com");
    expect(html).toContain('aria-label="6-digit code"');
    expect(html).toContain("Continue");
    expect(html).toContain("Change email");
    expect(html).toContain("Resend code in 60s");
  });

  it("has no card frame and uses the same big heading as the email screen", () => {
    const html = render();
    expect(html).not.toContain("bg-muted/60 p-5");
    expect(html).toContain("text-[28px] font-extrabold");
  });
});
