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

  it("highlights the email box", () => {
    const openHtml = render(true);
    expect(openHtml).toContain("Sign up for Friday’s open mic");
    expect(openHtml).not.toContain("Your email");
    expect(openHtml).toContain("bg-white");
    const closedHtml = render(false);
    expect(closedHtml).toContain("Sign in");
    expect(closedHtml).not.toContain("Sign up for Friday’s open mic");
  });

  it("paused: names the next open mic and disables the email box and the button", () => {
    const html = renderToStaticMarkup(createElement(EmailStep, { client: null as never, email: "", setEmail: () => {}, open: false, pausedLabel: "Next Open Mic 12/04/2026", onSent: () => {} }));
    expect(html).toContain("Next Open Mic 12/04/2026");
    expect(html).toContain("min-[375px]:text-[17px] min-[390px]:text-[18px]");
    expect(html).toContain("Request your spot");
    expect(html).not.toContain("Sign up for Friday’s open mic");
    expect(html.match(/disabled=""/g)?.length).toBe(2);
  });

  it("not paused: nothing is disabled", () => {
    expect(render(true)).not.toContain('disabled=""');
    expect(render(false)).not.toContain('disabled=""');
  });

  it("paused with its own texts: shows them in place of the defaults and hides the email box and button", () => {
    const html = renderToStaticMarkup(createElement(EmailStep, { client: null as never, email: "", setEmail: () => {}, open: false, pausedLabel: "Next Open Mic 12/04/2026", pausedPill: "Free Show This Friday", pausedHeading: "No open mic this Friday", pausedNote: "Come out for Thanksgiving Leftovers.", onSent: () => {} }));
    expect(html).toContain("Free Show This Friday");
    expect(html).toContain("No open mic this Friday");
    expect(html).toContain("Come out for Thanksgiving Leftovers.");
    expect(html).not.toContain("Next Open Mic 12/04/2026");
    expect(html).not.toContain("Request your spot");
    expect(html).not.toContain("6-digit code");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("Send my code");
    expect(html).not.toContain("you@example.com");
    expect(html).toContain("Hosts: sign in here");
  });

  it("paused with only the pill text keeps the disabled box", () => {
    const html = renderToStaticMarkup(createElement(EmailStep, { client: null as never, email: "", setEmail: () => {}, open: false, pausedLabel: "Next Open Mic 12/04/2026", pausedPill: "Free Show This Friday", onSent: () => {} }));
    expect(html).toContain("Send my code");
    expect(html.match(/disabled=""/g)?.length).toBe(2);
    expect(html).not.toContain("Hosts: sign in here");
  });

  it("not paused: the paused texts are ignored", () => {
    const html = renderToStaticMarkup(createElement(EmailStep, { client: null as never, email: "", setEmail: () => {}, open: true, pausedPill: "Free Show This Friday", pausedHeading: "No open mic this Friday", pausedNote: "Come out for Thanksgiving Leftovers.", onSent: () => {} }));
    expect(html).not.toContain("Free Show This Friday");
    expect(html).not.toContain("No open mic this Friday");
    expect(html).not.toContain("Come out for Thanksgiving Leftovers.");
    expect(html).toContain("Request your spot");
  });
});
