import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { decryptSecret, encryptSecret, keyHint } = await import("./keys");
const { looksLikeKey, pickModel } = await import("./providers");

describe("encrypted keys", () => {
  const k = randomBytes(32);
  it("round-trips, and never stores the key in the clear", () => {
    const stored = encryptSecret("sk-ant-api03-SECRET-1234", k);
    expect(stored).not.toContain("SECRET");
    expect(decryptSecret(stored, k)).toBe("sk-ant-api03-SECRET-1234");
  });
  it("uses a fresh random IV each time", () => {
    expect(encryptSecret("same", k)).not.toBe(encryptSecret("same", k));
  });
  it("refuses a tampered value or the wrong secret", () => {
    const stored = encryptSecret("sk-ant-x", k);
    const parts = stored.split(".");
    const flipped = [parts[0], parts[1], parts[2], (parts[3] as string).slice(0, -2) + "AA"].join(".");
    expect(() => decryptSecret(flipped, k)).toThrow();
    expect(() => decryptSecret(stored, randomBytes(32))).toThrow();
  });
  it("shows only the last four characters", () => {
    expect(keyHint("sk-ant-abcdef1234")).toBe("…1234");
  });
});

describe("provider helpers", () => {
  it("checks the rough shape of a pasted key", () => {
    expect(looksLikeKey("anthropic", "sk-ant-api03-" + "x".repeat(40))).toBe(true);
    expect(looksLikeKey("anthropic", "sk-proj-" + "x".repeat(40))).toBe(false);
    expect(looksLikeKey("openai", "sk-proj-" + "x".repeat(40))).toBe(true);
    expect(looksLikeKey("openai", "sk-proj- with spaces " + "x".repeat(40))).toBe(false);
    expect(looksLikeKey("openai", "short")).toBe(false);
  });
  it("picks a Sonnet model for Anthropic, else the newest", () => {
    expect(pickModel("anthropic", ["claude-opus-9", "claude-sonnet-9", "claude-haiku-9"])).toBe("claude-sonnet-9");
    expect(pickModel("anthropic", ["claude-opus-9", "claude-haiku-9"])).toBe("claude-opus-9");
    expect(pickModel("anthropic", [])).toBeNull();
  });
  it("picks the newest general GPT model for OpenAI, skipping small and special ones", () => {
    expect(pickModel("openai", ["gpt-4o", "gpt-5-mini", "gpt-5", "gpt-5-audio-preview", "whisper-1", "gpt-4.1", "gpt-5-2025-08-07"])).toBe("gpt-5");
    expect(pickModel("openai", ["gpt-4o", "gpt-4.1", "dall-e-3"])).toBe("gpt-4.1");
    expect(pickModel("openai", ["whisper-1"])).toBeNull();
  });
});

describe("reading a streamed answer", () => {
  it("handles events split across chunks", async () => {
    const { readSse } = await import("./providers");
    const enc = new TextEncoder();
    const chunks = ['data: {"a":1}\n\ndata: {"b"', ':2}\n\ndata: [DONE]\n\n'];
    const stream = new ReadableStream<Uint8Array>({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } });
    const got: string[] = [];
    await readSse(stream, (d) => got.push(d));
    expect(got).toEqual(['{"a":1}', '{"b":2}', "[DONE]"]);
  });
});
