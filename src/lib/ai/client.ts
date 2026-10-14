/** One call to Claude: a system prompt, one user message, the text of the reply. Throws on any failure. */
export async function askClaudeText(input: { system: string; user: string; apiKey: string; maxTokens: number; timeoutMs?: number; images?: ClaudeImage[] }): Promise<string> {
  // Plain text stays a string (as before); pictures turn the message into content blocks.
  const content: unknown = input.images?.length ? [...input.images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } })), { type: "text", text: input.user }] : input.user;
  // Local development can point at a stand-in server (AI_TEST_BASE_URL, as providers.ts does) to test without spending money.
  const test = process.env.NODE_ENV !== "production" ? process.env.AI_TEST_BASE_URL : undefined;
  const res = await fetch(`${test ? `${test}/anthropic` : "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": input.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "claude-sonnet-5-5",
      max_tokens: input.maxTokens,
      system: input.system,
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(input.timeoutMs ?? 45_000),
  });
  const body = (await res.json().catch(() => ({}))) as { content?: Array<{ type: string; text?: string }>; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? `Claude answered ${res.status}`);
  const text = body.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Claude's reply had no text");
  return text;
}

/** A picture for the model to look at (a flyer, a screenshot of a post). */
export interface ClaudeImage {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  base64: string;
}
