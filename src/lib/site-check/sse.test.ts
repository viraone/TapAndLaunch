import { describe, expect, it } from "vitest";
import { encodeComment, encodeEvent } from "./sse";

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("encodeEvent", () => {
  it("writes an event line, a data line and a blank line", () => {
    expect(decode(encodeEvent("page", { type: "page", url: "https://example.com/" }))).toBe(
      'event: page\ndata: {"type":"page","url":"https://example.com/"}\n\n'
    );
  });
});

describe("encodeComment", () => {
  it("writes a comment line and a blank line", () => {
    expect(decode(encodeComment("ping"))).toBe(": ping\n\n");
  });
});
