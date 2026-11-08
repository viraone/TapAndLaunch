import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignupHeader } from "./OpenMicSignupRuntime";

type Props = Parameters<typeof SignupHeader>[0];
const config = {} as Props["config"];

function render(extra: Partial<Props>): string {
  return renderToStaticMarkup(
    createElement(SignupHeader, {
      config,
      showDate: "Friday, Nov 13",
      open: true,
      hidePill: false,
      reopenText: "",
      closesAt: "Thu 11:00 PM",
      ...extra,
    }),
  );
}

describe("SignupHeader start time label", () => {
  it("hides the Start time label by default", () => {
    const html = render({});
    expect(html).toContain("Next show");
    expect(html).not.toContain("Start time");
  });
  it("hides it when showStartTime is false", () => {
    expect(render({ showStartTime: false })).not.toContain("Start time");
  });
  it("shows it when showStartTime is true", () => {
    expect(render({ showStartTime: true })).toContain("Start time");
  });
});
