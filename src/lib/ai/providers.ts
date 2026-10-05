export type AiProvider = "anthropic" | "openai";

/** The provider's address. Local development can point at a stand-in server (AI_TEST_BASE_URL) to test without
 * spending money; this is ignored in production. */
function base(provider: AiProvider): string {
  const test = process.env.NODE_ENV !== "production" ? process.env.AI_TEST_BASE_URL : undefined;
  if (test) return `${test}/${provider}`;
  return provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com";
}

export const PROVIDER_LABELS: Record<AiProvider, string> = { anthropic: "Anthropic (Claude)", openai: "OpenAI (ChatGPT)" };

/** Rough shape check before calling the provider, so an obvious paste mistake gets a clear message. */
export function looksLikeKey(provider: AiProvider, key: string): boolean {
  const k = key.trim();
  if (/\s/.test(k) || k.length < 20 || k.length > 300) return false;
  return provider === "anthropic" ? k.startsWith("sk-ant-") : k.startsWith("sk-");
}

/**
 * Picks the model to build with from the models this key can use, so nothing depends on guessing model names.
 * Anthropic lists newest first; a Sonnet model is the best balance of quality and cost for building, else the newest.
 * OpenAI: the newest general GPT model, skipping the small, audio, image, realtime and search variants.
 */
export function pickModel(provider: AiProvider, ids: string[]): string | null {
  if (ids.length === 0) return null;
  if (provider === "anthropic") {
    const claude = ids.filter((id) => id.startsWith("claude-"));
    return claude.find((id) => id.includes("sonnet")) ?? claude[0] ?? null;
  }
  const general = ids.filter((id) => /^gpt-\d/.test(id) && !/(mini|nano|audio|realtime|search|transcribe|tts|image|vision|instruct|codex|preview|\d{4}-\d{2}-\d{2})/.test(id));
  const version = (id: string) => Number(/^gpt-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0);
  general.sort((a, b) => version(b) - version(a) || a.length - b.length);
  return general[0] ?? null;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function friendly(provider: AiProvider, status: number, detail: string | undefined): string {
  if (status === 401 || status === 403) return `${PROVIDER_LABELS[provider]} refused this key. Check you copied all of it, and that it's still active.`;
  if (status === 429) return `${PROVIDER_LABELS[provider]} says you're over your limit or out of credit. Check your account's billing.`;
  return detail ? `${PROVIDER_LABELS[provider]} error: ${detail}` : `${PROVIDER_LABELS[provider]} answered ${status}.`;
}

/** Lists the models this key can use. A failure here means the key doesn't work. */
export async function listModels(provider: AiProvider, key: string): Promise<string[]> {
  const res =
    provider === "anthropic"
      ? await fetch(`${base("anthropic")}/v1/models?limit=100`, { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(15_000) })
      : await fetch(`${base("openai")}/v1/models`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json().catch(() => ({}))) as { data?: Array<{ id: string }>; error?: { message?: string } };
  if (!res.ok) throw new ProviderError(friendly(provider, res.status, body.error?.message), res.status);
  return (body.data ?? []).map((m) => m.id);
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** One reply from the model, asked to answer with a JSON object. */
export async function chatJson(provider: AiProvider, key: string, model: string, system: string, turns: ChatTurn[]): Promise<string> {
  if (provider === "anthropic") {
    const res = await fetch(`${base("anthropic")}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 4000, system, messages: turns }),
      signal: AbortSignal.timeout(55_000),
    });
    const body = (await res.json().catch(() => ({}))) as { content?: Array<{ type: string; text?: string }>; error?: { message?: string } };
    if (!res.ok) throw new ProviderError(friendly(provider, res.status, body.error?.message), res.status);
    return body.content?.find((c) => c.type === "text")?.text ?? "";
  }
  const res = await fetch(`${base("openai")}/v1/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, ...turns] }),
    signal: AbortSignal.timeout(55_000),
  });
  const body = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!res.ok) throw new ProviderError(friendly(provider, res.status, body.error?.message), res.status);
  return body.choices?.[0]?.message?.content ?? "";
}

/** Reads a server-sent-events body and calls `onData` with each event's `data:` payload. */
export async function readSse(body: ReadableStream<Uint8Array>, onData: (data: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const event = buffer.slice(0, cut);
      buffer = buffer.slice(cut).replace(/^\r?\n\r?\n/, "");
      for (const line of event.split(/\r?\n/)) if (line.startsWith("data:")) onData(line.slice(5).trim());
    }
  }
}

/**
 * One long answer from the model, streamed: `onText` gets each new piece as it arrives, and the full text is returned.
 * Used for writing code, where an answer can take a minute and should appear as it is written.
 */
export async function streamText(
  provider: AiProvider,
  key: string,
  model: string,
  system: string,
  turns: ChatTurn[],
  onText: (piece: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const timeout = AbortSignal.timeout(280_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const res =
    provider === "anthropic"
      ? await fetch(`${base("anthropic")}/v1/messages`, {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          // The long instructions are cached by Anthropic for a few minutes, so follow-up requests start sooner and cost less.
          body: JSON.stringify({ model, max_tokens: 16000, stream: true, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], messages: turns }),
          signal: combined,
        })
      : await fetch(`${base("openai")}/v1/chat/completions`, {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ model, stream: true, max_completion_tokens: 16000, messages: [{ role: "system", content: system }, ...turns] }),
          signal: combined,
        });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new ProviderError(friendly(provider, res.status, body.error?.message), res.status);
  }
  let full = "";
  await readSse(res.body, (data) => {
    if (data === "[DONE]") return;
    try {
      const event = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string }; choices?: Array<{ delta?: { content?: string } }>; error?: { message?: string } };
      if (event.type === "error") throw new ProviderError(event.error?.message ?? "The AI stopped unexpectedly.", 502);
      const piece = provider === "anthropic" ? (event.type === "content_block_delta" && event.delta?.type === "text_delta" ? event.delta.text : undefined) : event.choices?.[0]?.delta?.content;
      if (piece) {
        full += piece;
        onText(piece);
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error;
    }
  });
  return full;
}
