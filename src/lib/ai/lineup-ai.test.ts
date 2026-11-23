import { afterEach, describe, expect, it, vi } from "vitest";
import { askDeepSeek, type DeepSeekTurn } from "./deepseek";
import { askGemini } from "./gemini";
import { askLineupAi } from "./lineup-ai";

vi.mock("./deepseek", () => ({ askDeepSeek: vi.fn() }));
vi.mock("./gemini", () => ({ askGemini: vi.fn() }));

const turns: DeepSeekTurn[] = [{ role: "user", content: "hi" }];

afterEach(() => {
  vi.mocked(askGemini).mockReset();
  vi.mocked(askDeepSeek).mockReset();
  vi.restoreAllMocks();
});

describe("askLineupAi", () => {
  it("uses Gemini's answer and leaves DeepSeek alone", async () => {
    vi.mocked(askGemini).mockResolvedValue("from gemini");
    await expect(askLineupAi({ system: "s", turns, geminiKey: "g-key", deepseekKey: "d-key" })).resolves.toBe("from gemini");
    expect(askGemini).toHaveBeenCalledWith({ system: "s", turns, apiKey: "g-key" });
    expect(askDeepSeek).not.toHaveBeenCalled();
  });

  it("falls back to DeepSeek when Gemini fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(askGemini).mockRejectedValue(new Error("Gemini answered 429."));
    vi.mocked(askDeepSeek).mockResolvedValue("from deepseek");
    await expect(askLineupAi({ system: "s", turns, geminiKey: "g-key", deepseekKey: "d-key" })).resolves.toBe("from deepseek");
    expect(askDeepSeek).toHaveBeenCalledWith({ system: "s", turns, apiKey: "d-key" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]![0])).toContain("429");
    expect(String(log.mock.calls[0]![0])).not.toContain("g-key");
  });

  it("goes straight to DeepSeek when there is no Gemini key", async () => {
    vi.mocked(askDeepSeek).mockResolvedValue("from deepseek");
    await expect(askLineupAi({ system: "s", turns, deepseekKey: "d-key" })).resolves.toBe("from deepseek");
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("passes Gemini's error on when there is no DeepSeek key", async () => {
    vi.mocked(askGemini).mockRejectedValue(new Error("Gemini answered 429."));
    await expect(askLineupAi({ system: "s", turns, geminiKey: "g-key" })).rejects.toThrow("Gemini answered 429.");
    expect(askDeepSeek).not.toHaveBeenCalled();
  });

  it("refuses when neither key is set", async () => {
    await expect(askLineupAi({ system: "s", turns })).rejects.toThrow("No AI key is set.");
  });
});
