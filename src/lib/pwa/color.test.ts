import { describe, expect, it } from "vitest";
import { readableOn } from "./color";

describe("readableOn", () => {
  it("puts white on strong brand colors and black on light ones", () => {
    expect(readableOn("#e11d48")).toBe("#ffffff");
    expect(readableOn("#c2410c")).toBe("#ffffff");
    expect(readableOn("#6366f1")).toBe("#ffffff");
    expect(readableOn("#fde047")).toBe("#0a0a0a");
    expect(readableOn("#ffffff")).toBe("#0a0a0a");
    expect(readableOn("#fff")).toBe("#0a0a0a");
  });
  it("falls back to white for anything that isn't a hex color", () => {
    expect(readableOn("tomato")).toBe("#ffffff");
  });
});
