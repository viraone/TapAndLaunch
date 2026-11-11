import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequestForm } from "./OpenMicSignupRuntime";

function render(profile: { stage_name: string; instagram: string; performed_before: boolean | null }): string {
  return renderToStaticMarkup(
    createElement(RequestForm, {
      client: null as never,
      user: { id: "u1", email: "you@example.com" } as never,
      profile,
      onRequested: () => {},
      onProfileSaved: () => {},
    })
  );
}

describe("RequestForm", () => {
  it("shows the heading, every field and the button for a first-timer", () => {
    const html = render({ stage_name: "", instagram: "", performed_before: null });
    expect(html).toContain("Your details");
    expect(html).toContain("Stage name");
    expect(html).toContain("Instagram");
    expect(html).toContain("Performed at this show before?");
    expect(html).toContain("Request my spot");
    expect(html).toContain("Fill in the starred fields");
  });

  it("asks a returning comic only to tick the boxes", () => {
    const html = render({ stage_name: "Sam", instagram: "@sam", performed_before: true });
    expect(html).toContain('value="Sam"');
    expect(html).toContain("Tick both boxes to continue");
    expect(html).not.toContain("Fill in the starred fields");
  });

  it("has no card frame and uses the same big heading as the email screen", () => {
    const html = render({ stage_name: "", instagram: "", performed_before: null });
    expect(html).not.toContain("bg-muted/60 p-5");
    expect(html).toContain("text-[28px] font-extrabold");
  });
});
