import type { DeepSeekTurn } from "./deepseek";

/**
 * One answer from Gemini, through Google's OpenAI-shaped address. Used by StageTime's lineup helper only, as the
 * backup to DeepSeek (Lao Voice stays on DeepSeek alone). The caller supplies the key; this function never logs it and
 * only puts the status, never the key, in an error. A blank answer is asked once more.
 */
export async function askGemini(input: {
  system: string;
  turns: DeepSeekTurn[];
  apiKey: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const base = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, "");
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
        temperature: 0,
        max_tokens: input.maxTokens ?? 1200,
        messages: [{ role: "system", content: input.system }, ...input.turns],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> };
    if (!res.ok) throw new Error(`Gemini answered ${res.status}.`);
    const content = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (content) return content;
  }
  throw new Error("Gemini returned an empty answer twice.");
}
