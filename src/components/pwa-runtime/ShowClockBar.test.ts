import { describe, expect, it } from "vitest"; import { createElement } from "react"; import { renderToStaticMarkup } from "react-dom/server"; import { ShowClockBar } from "./ShowClockBar";
const controls = { onStart: () => {}, onStop: () => {}, onReset: () => {}, busy: false };
function render(props: Parameters<typeof ShowClockBar>[0]) { return renderToStaticMarkup(createElement(ShowClockBar, props)); }
describe("ShowClockBar", () => {
  it("running: the countdown and a lit STOP", () => {
    const html = render({ clock: { kind: "running", index: 1, remainingMs: 120000, totalMs: 180000, onDeckIndex: 2 }, started: true, controls });
    expect(html).toContain("2:00");
    expect(html).toContain(">STOP<");
    expect(html).toContain(">START<");
    expect(html).toMatch(/<button[^>]*bg-primary[^>]*>STOP</);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>START</);
    expect(html).not.toContain("text-red-400");
  });
  it("over time: red", () => {
    const html = render({ clock: { kind: "running", index: 1, remainingMs: -15000, totalMs: 180000, onDeckIndex: 2 }, started: true, controls });
    expect(html).toContain("+0:15");
    expect(html).toContain("text-red-400");
    expect(html).toContain("bg-red-950");
  });
  it("between comics: the next set length, still, and a lit START", () => {
    const html = render({ clock: { kind: "idle", nextIndex: 2, nextMs: 180000 }, started: true, controls });
    expect(html).toContain("3:00");
    expect(html).toMatch(/<button[^>]*bg-primary[^>]*>START</);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>STOP</);
  });
  it("before the show: START lit, no RESET", () => {
    const html = render({ clock: { kind: "idle", nextIndex: 1, nextMs: 180000 }, started: false, controls });
    expect(html).toContain(">START<");
    expect(html).not.toContain("RESET");
  });
  it("after the last comic: That's the show and RESET", () => {
    const html = render({ clock: { kind: "idle", nextIndex: -1, nextMs: 0 }, started: true, controls });
    expect(html).toMatch(/That(&#x27;|')s the show/);
    expect(html).toContain(">RESET<");
    expect(html).not.toContain(">START<");
  });
  it("a comic's phone has no buttons", () => {
    const html = render({ clock: { kind: "running", index: 1, remainingMs: 120000, totalMs: 180000, onDeckIndex: 2 }, started: true });
    expect(html).toContain("2:00");
    expect(html).not.toContain("<button");
  });
  it("busy: both buttons dim", () => {
    const html = render({ clock: { kind: "running", index: 1, remainingMs: 120000, totalMs: 180000, onDeckIndex: 2 }, started: true, controls: { ...controls, busy: true } });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>STOP</);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>START</);
  });
});
