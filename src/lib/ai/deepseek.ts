/** One turn in a DeepSeek chat: the host's question or an earlier answer. */
export interface DeepSeekTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * One answer from DeepSeek. Used by StageTime's lineup helper. The caller supplies the key; this function never logs
 * it and only puts the status, never the key, in an error.
 *
 * No `response_format: json_object`: measured 2026-11-03, it came back blank on 5 of 16 calls (0 of 16 without it), and
 * the prompt already asks for JSON. max_tokens covers the model's reasoning too, so it can't be small: at 400 the
 * reasoning alone used it up. A blank answer is asked once more.
 */
export async function askDeepSeek(input: {
  system: string;
  turns: DeepSeekTurn[];
  apiKey: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
        temperature: 0,
        max_tokens: input.maxTokens ?? 1200,
        messages: [{ role: "system", content: input.system }, ...input.turns],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 30_000),
    });
    const body = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> };
    if (!res.ok) throw new Error(`DeepSeek answered ${res.status}.`);
    const content = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (content) return content;
  }
  throw new Error("DeepSeek returned an empty answer twice.");
}
