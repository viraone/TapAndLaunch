import { describe, expect, it } from "vitest";
import { eventType, parseSseBlock } from "./sse";

describe("parseSseBlock", () => {
  it("parses the event name and data JSON", () => {
    expect(parseSseBlock("event: start\ndata: {\"type\":\"start\",\"site\":\"https://x.com\"}\n")).toEqual({
      name: "start",
      data: { type: "start", site: "https://x.com" },
    });
  });

  it("returns null for a keep-alive comment with no data line", () => {
    expect(parseSseBlock(": ping")).toBeNull();
  });

  it("joins multi-line data and returns null for bad JSON", () => {
    expect(parseSseBlock("data: {\"a\":\ndata: 1}")?.data).toEqual({ a: 1 });
    expect(parseSseBlock("data: not-json")?.data).toBeNull();
  });
});

describe("eventType", () => {
  it("prefers the JSON's own type field", () => {
    expect(eventType("cached", { type: "score", score: 4 })).toBe("score");
  });

  it("falls back to the SSE event name (the cached event has no type)", () => {
    expect(eventType("cached", { checkedAt: "2026-10-26T00:00:00Z" })).toBe("cached");
  });

  it("falls back to unknown for neither", () => {
    expect(eventType(null, null)).toBe("unknown");
  });
});
