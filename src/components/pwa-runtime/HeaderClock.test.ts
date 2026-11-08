import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeaderClock } from "./HeaderClock";

describe("HeaderClock", () => {
  it("renders nothing until it has mounted", () => {
    expect(renderToStaticMarkup(createElement(HeaderClock))).toBe("");
  });
});
