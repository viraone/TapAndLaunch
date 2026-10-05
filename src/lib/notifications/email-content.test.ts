import { describe, expect, it } from "vitest";
import { chunk, escapeHtml, fromHeader, renderEmailHtml, signUnsubscribe, verifyUnsubscribe } from "./email-content";

describe("escapeHtml", () => {
  it("turns markup into plain text", () => {
    expect(escapeHtml(`<a href="x">Hi & 'bye'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Hi &amp; &#39;bye&#39;&lt;/a&gt;");
  });
});

describe("fromHeader", () => {
  it("puts the app name in front of the configured address", () => {
    expect(fromHeader("Gym Hub", "TapAndLaunch <noreply@tapandlaunch.com>")).toBe('"Gym Hub" <noreply@tapandlaunch.com>');
    expect(fromHeader("Gym Hub", "noreply@tapandlaunch.com")).toBe('"Gym Hub" <noreply@tapandlaunch.com>');
  });
  it("strips characters that could break the header", () => {
    expect(fromHeader('Evil" <x@y.z>\r\nBcc: a@b.c', "noreply@tapandlaunch.com")).toBe('"Evil x@y.zBcc: a@b.c" <noreply@tapandlaunch.com>');
  });
  it("falls back to the bare address with no name", () => {
    expect(fromHeader("<>", "noreply@tapandlaunch.com")).toBe("noreply@tapandlaunch.com");
  });
});

describe("renderEmailHtml", () => {
  const html = renderEmailHtml({ appName: "Gym <Hub>", title: "Sale!", body: "Line one\nline two\n\n<script>alert(1)</script>", unsubscribeUrl: "https://gym.example.com/unsubscribe?m=1&t=2" });
  it("escapes everything the merchant typed", () => {
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Gym &lt;Hub&gt;");
  });
  it("keeps line breaks and paragraphs", () => {
    expect(html).toContain("Line one<br>line two");
    expect(html.match(/<p style="margin:0 0 16px">/g)).toHaveLength(2);
  });
  it("ends with an unsubscribe link", () => {
    expect(html).toContain('href="https://gym.example.com/unsubscribe?m=1&amp;t=2"');
  });
});

describe("chunk", () => {
  it("splits into groups of at most the size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});

describe("unsubscribe token", () => {
  it("verifies only for the same member and secret", () => {
    const t = signUnsubscribe("m1", "secret");
    expect(verifyUnsubscribe("m1", t, "secret")).toBe(true);
    expect(verifyUnsubscribe("m2", t, "secret")).toBe(false);
    expect(verifyUnsubscribe("m1", t, "other")).toBe(false);
    expect(verifyUnsubscribe("m1", "junk", "secret")).toBe(false);
  });
});
