import { afterEach, describe, expect, it, vi } from "vitest";
import { askDeepSeek } from "./deepseek";

const ask = () => askDeepSeek({ system: "s", turns: [{ role: "user", content: "hi" }], apiKey: "secret-key" });
const answer = (content: string, status = 200) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

afterEach(() => vi.unstubAllGlobals());

describe("askDeepSeek", () => {
  it("returns the trimmed answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(' {"reply":"ok"} ')));
    await expect(ask()).resolves.toBe('{"reply":"ok"}');
  });

  it("asks once more when the answer is blank", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(answer("      ")).mockResolvedValueOnce(answer("second"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(ask()).resolves.toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after two blank answers", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => answer(""));
    vi.stubGlobal("fetch", fetchMock);
    await expect(ask()).rejects.toThrow("empty answer");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an error status, and never puts the key in the message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(answer("nope", 401));
    vi.stubGlobal("fetch", fetchMock);
    const error: Error = await ask().catch((e) => e);
    expect(error.message).toContain("401");
    expect(error.message).not.toContain("secret-key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves JSON mode off and allows room for the model's reasoning", async () => {
    const fetchMock = vi.fn().mockResolvedValue(answer("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await ask();
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent.response_format).toBeUndefined();
    expect(sent.max_tokens).toBe(1200);
  });
});
