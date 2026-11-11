import { describe, expect, it } from "vitest";
import { createVad, feedVad, levelOf, type Vad, type VadVerdict } from "./vad";

/** About one microphone chunk, in milliseconds. */
const CHUNK = 85;

function feedMany(vad: Vad, level: number, chunks: number): VadVerdict {
  let last: VadVerdict = "listening";
  for (let i = 0; i < chunks; i++) last = feedVad(vad, level, CHUNK);
  return last;
}

describe("levelOf", () => {
  it("is the root mean square of the samples", () => {
    expect(levelOf(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
    expect(levelOf(new Float32Array(100))).toBe(0);
    expect(levelOf(new Float32Array(0))).toBe(0);
  });
});

describe("feedVad", () => {
  it("says end once someone has talked and then been quiet for 1.4 seconds", () => {
    const vad = createVad();
    expect(feedMany(vad, 0.001, 5)).toBe("listening");
    expect(feedMany(vad, 0.2, 10)).toBe("listening");
    expect(vad.spoke).toBe(true);
    expect(feedMany(vad, 0.001, 16)).toBe("listening");
    expect(feedVad(vad, 0.001, CHUNK)).toBe("end");
  });
  it("keeps listening through a short pause in the middle of talking", () => {
    const vad = createVad();
    feedMany(vad, 0.2, 10);
    expect(feedMany(vad, 0.001, 10)).toBe("listening");
    expect(feedMany(vad, 0.2, 3)).toBe("listening");
    expect(feedMany(vad, 0.001, 16)).toBe("listening");
    expect(feedVad(vad, 0.001, CHUNK)).toBe("end");
  });
  it("does not count one loud click as talking", () => {
    const vad = createVad();
    feedVad(vad, 0.5, CHUNK);
    expect(vad.spoke).toBe(false);
    expect(feedMany(vad, 0.001, 30)).toBe("listening");
    expect(vad.peak).toBe(0.5);
  });
  it("gives up after 8 seconds when nobody talks", () => {
    const vad = createVad();
    expect(feedMany(vad, 0.002, 94)).toBe("listening");
    expect(feedVad(vad, 0.002, CHUNK)).toBe("nospeech");
  });
  it("asks for a louder voice in a room with steady noise", () => {
    const vad = createVad();
    feedMany(vad, 0.008, 20);
    feedVad(vad, 0.02, CHUNK);
    expect(vad.loudMs).toBe(0);
    expect(vad.spoke).toBe(false);
    feedMany(vad, 0.05, 2);
    expect(vad.spoke).toBe(true);
  });
});
