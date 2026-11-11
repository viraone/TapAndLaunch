import { describe, expect, it } from "vitest";
import { VOICE_SAMPLE_RATE, downsample, encodeWav, joinChunks } from "./wav";

describe("joinChunks", () => {
  it("puts the chunks end to end", () => {
    const joined = joinChunks([new Float32Array([1, 2]), new Float32Array([3])]);
    expect(Array.from(joined)).toEqual([1, 2, 3]);
  });
  it("gives an empty array for no chunks", () => {
    expect(joinChunks([]).length).toBe(0);
  });
});

describe("downsample", () => {
  it("averages pairs when the rate is halved", () => {
    const out = downsample(new Float32Array([1, 1, 3, 3]), 32000, 16000);
    expect(Array.from(out)).toEqual([1, 3]);
  });
  it("returns the same samples when the rate is already low enough", () => {
    const samples = new Float32Array([0.5, -0.5]);
    expect(downsample(samples, 16000)).toBe(samples);
  });
  it("turns one second at 48 kHz into 16,000 samples", () => {
    expect(downsample(new Float32Array(48000), 48000).length).toBe(VOICE_SAMPLE_RATE);
  });
});

describe("encodeWav", () => {
  it("writes a 44-byte header and two bytes per sample", () => {
    const view = new DataView(encodeWav(new Float32Array([0, 1, -1])));
    expect(view.byteLength).toBe(50);
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(42);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });
});
