import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RestartShowButton } from "./RestartShowButton";

describe("RestartShowButton", () => {
  it("renders the restart label and not the armed text", () => {
    const html = renderToStaticMarkup(createElement(RestartShowButton, { busy: false, onRestart: () => {} }));
    expect(html).toContain(">Restart the show<");
    expect(html).not.toContain("Tap again");
  });
  it("disables the button when busy", () => {
    const html = renderToStaticMarkup(createElement(RestartShowButton, { busy: true, onRestart: () => {} }));
    expect(html).toContain("disabled");
  });
});
