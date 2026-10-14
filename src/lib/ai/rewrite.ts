import { askClaudeText } from "@/lib/ai/client";
import { parseModelJson } from "@/lib/ai/app-spec";
import { collectConfigCopy, readModelText, sanitize, type CopyField } from "@/lib/ai/copy-fields";
import type { Starter } from "@/lib/apps/templates";

/**
 * AI-written copy for a new website, the safe way round: the site is already built from its starter (its look, its
 * sections, its sample data); the model is handed only the *words* — a flat map of key → text — and asked for the
 * same keys with new text about the person described. It never sees or returns a URL, a path, a page, a block type
 * or a setting, every value is capped at the original field's length, anything missing or malformed keeps the
 * starter's text, and any failure keeps all of it. So a clever description can change what the site says, never
 * what it does. Costs a cent or two and takes 10–20 seconds; counted against the same daily limit as
 * "Describe your app". The list of which keys are words lives in `copy-fields.ts`, shared with the other AI edits.
 */

export type { CopyField };

/** Every copy field of the starter, with a setter. Keys are `page/block/path`, e.g. `0/0/headline`, `0/3/items/1/quote`. */
export function collectCopy(starter: Starter): CopyField[] {
  const fields: CopyField[] = [];
  starter.pages.forEach((page, pi) => {
    page.blocks.forEach((block, bi) => {
      fields.push(...collectConfigCopy(block.type, block.config as Record<string, unknown>, `${pi}/${bi}`));
    });
  });
  return fields;
}

const SYSTEM = `You rewrite the words of a small website so they are about the person or business described, in their voice. You get a JSON object of key → text (the current words, written for a generic business of this kind). Reply with ONLY a JSON object with exactly the same keys and your new text as the values: no markdown, no explanation, no extra keys.

Rules:
- Keep each value about the same length as the original, and never longer than its limit (given as "key": {"text": …, "max": N}).
- Keep each value's job: a headline stays a headline, a button label stays two or three words, a question stays a question.
- Use what the description says (what they do, who for, where, their tone). Where it says nothing, keep the original's meaning in a more specific voice; do not invent facts. Never invent phone numbers, addresses, prices, dates, years, counts, awards, or names of real people or places; keep an original's number only if the description supports it, otherwise keep it as a generic, clearly-editable figure like the original.
- Sample notes such as "(Sample product …)" or "This is a sample …" must stay in the value exactly as written.
- Write in the language of the description. Plain words, short sentences, no exclamation marks, no emoji.`;

export interface RewriteResult {
  starter: Starter;
  /** "ai": the words were rewritten. "template": kept the starter's words (no key, or the model's answer was unusable). */
  source: "ai" | "template";
  note?: string;
  /** How many fields the model changed. */
  changed: number;
}

/** Rewrites the starter's copy for the person described. Never throws; mutates and returns the same starter. */
export async function rewriteStarterCopy(starter: Starter, about: string, apiKey = process.env.ANTHROPIC_API_KEY): Promise<RewriteResult> {
  if (!apiKey) return { starter, source: "template", changed: 0, note: "no ANTHROPIC_API_KEY" };
  const fields = collectCopy(starter);
  if (fields.length === 0) return { starter, source: "template", changed: 0, note: "nothing to rewrite" };

  const payload = Object.fromEntries(fields.map((f) => [f.key, { text: f.text, max: f.max }]));
  const clean = about.replace(/<\/?description>/gi, "").trim().slice(0, 500);
  const user = `<description>${clean}</description>\n\n${JSON.stringify(payload)}`;

  try {
    const reply = parseModelJson(await askClaudeText({ system: SYSTEM, user, apiKey, maxTokens: 4000, timeoutMs: 50_000 }));
    if (!reply || typeof reply !== "object" || Array.isArray(reply)) return { starter, source: "template", changed: 0, note: "the reply was not an object" };
    const changed = applyCopyReply(fields, reply as Record<string, unknown>);
    return changed > 0 ? { starter, source: "ai", changed } : { starter, source: "template", changed: 0, note: "the model changed nothing" };
  } catch (error) {
    return { starter, source: "template", changed: 0, note: error instanceof Error ? error.message : "the model call failed" };
  }
}

/** Writes the model's values into the fields they belong to (sanitised, capped); returns how many changed. */
export function applyCopyReply(fields: CopyField[], values: Record<string, unknown>): number {
  let changed = 0;
  for (const field of fields) {
    const text = readModelText(values[field.key]);
    if (text === null) continue;
    const next = sanitize(text, field.max);
    if (next === field.text) continue;
    if (!next && field.text) continue; // never blank a field that had words
    field.set(next);
    changed += 1;
  }
  return changed;
}
