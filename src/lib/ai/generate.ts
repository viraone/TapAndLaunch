import { GeneratedAppSchema, SYSTEM_PROMPT, buildUserMessage, extractName, matchTemplate, matchedStarter, parseModelJson, specToStarter } from "@/lib/ai/app-spec";
import { STARTER_TEMPLATES, type Starter } from "@/lib/apps/templates";

/** Describe-your-app uses Claude when `ANTHROPIC_API_KEY` is set; without it, the description is matched to the closest template. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface GeneratedResult {
  name: string;
  starter: Starter;
  /** "ai": designed by the model. "matched": picked the closest template (no key, or the model's answer was unusable). */
  source: "ai" | "matched";
  /** Why the model's design was not used, for the server log. */
  note?: string;
}

const DEFAULT_MODEL = "claude-sonnet-5-5";

async function askClaude(description: string, name: string | undefined, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.AI_MODEL || DEFAULT_MODEL,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(description, name) }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = (await res.json().catch(() => ({}))) as { content?: Array<{ type: string; text?: string }>; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? `Claude answered ${res.status}`);
  const text = body.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Claude's reply had no text");
  return text;
}

/** Designs a first version of the app from a sentence. Never throws: any problem falls back to the closest template. */
export async function generateApp(input: { description: string; name?: string }): Promise<GeneratedResult> {
  const given = input.name?.trim() || extractName(input.description) || undefined;
  const fallback = (note: string): GeneratedResult => {
    const id = matchTemplate(input.description);
    const template = STARTER_TEMPLATES.find((t) => t.id === id);
    const name = given ?? `My ${template?.name ?? "app"}`;
    return { name, starter: matchedStarter(input.description, name).starter, source: "matched", note };
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback("no ANTHROPIC_API_KEY");
  try {
    const parsed = GeneratedAppSchema.safeParse(parseModelJson(await askClaude(input.description, given, apiKey)));
    if (!parsed.success) return fallback(`the model's design failed validation: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    const name = (given ?? parsed.data.name).slice(0, 60);
    return { name, starter: specToStarter(parsed.data, name), source: "ai" };
  } catch (error) {
    return fallback(error instanceof Error ? error.message : "the model call failed");
  }
}
