import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HostSwitch } from "./HostSwitch";

describe("HostSwitch", () => {
  it("draws the everyone version on the server (the hosts cookie is read by the page, the switch only after sign-in)", () => {
    const out = renderToStaticMarkup(createElement(HostSwitch, { forEveryone: createElement("p", null, "flyer"), forHosts: createElement("p", null, "logo") }));
    expect(out).toContain("flyer");
    expect(out).not.toContain("logo");
  });
});
