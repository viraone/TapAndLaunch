/** One call to Claude: a system prompt, one user message, the text of the reply. Throws on any failure. */
export async function askClaudeText(input: { system: string; user: string; apiKey: string; maxTokens: number; timeoutMs?: number }): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": input.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "claude-sonnet-5-5",
      max_tokens: input.maxTokens,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    }),
    signal: AbortSignal.timeout(input.timeoutMs ?? 45_000),
  });
  const body = (await res.json().catch(() => ({}))) as { content?: Array<{ type: string; text?: string }>; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? `Claude answered ${res.status}`);
  const text = body.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Claude's reply had no text");
  return text;
}
