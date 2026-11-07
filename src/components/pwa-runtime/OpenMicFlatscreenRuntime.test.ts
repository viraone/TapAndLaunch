import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OpenMicFlatscreenRuntime } from "./OpenMicFlatscreenRuntime";
import type { OpenMicSignupBlockConfig } from "@/types/database";

function render(config: OpenMicSignupBlockConfig) {
  return renderToStaticMarkup(createElement(OpenMicFlatscreenRuntime, { config }));
}

describe("OpenMicFlatscreenRuntime", () => {
  it("shows the flyer with the show's name in its alt text", () => {
    const html = render({ view: "tv", flyer_url: "https://example.com/flyer.jpg", show_name: "Read The Room" });

    expect(html).toContain("https://example.com/flyer.jpg");
    expect(html).toContain("Read The Room flyer");
  });

  it("says there is no flyer yet when none is set", () => {
    const html = render({ view: "tv" });

    expect(html).toContain("No flyer yet.");
    expect(html).not.toContain("<img");
  });
});
