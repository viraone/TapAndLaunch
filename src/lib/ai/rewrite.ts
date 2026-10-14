import { askClaudeText } from "@/lib/ai/client";
import { parseModelJson } from "@/lib/ai/app-spec";
import type { Starter } from "@/lib/apps/templates";

/**
 * AI-written copy for a new website, the safe way round: the site is already built from its starter (its look, its
 * sections, its sample data); the model is handed only the *words* — a flat map of key → text — and asked for the
 * same keys with new text about the person described. It never sees or returns a URL, a path, a page, a block type
 * or a setting, every value is capped at the original field's length, anything missing or malformed keeps the
 * starter's text, and any failure keeps all of it. So a clever description can change what the site says, never
 * what it does. Costs a cent or two and takes 10–20 seconds; counted against the same daily limit as
 * "Describe your app".
 */

/** The copy fields of each block type, by config key (`items.*.quote` means every item's quote). Nothing else is
 * ever sent: not `image_url`, `src`, `url`, `button_page`, `address`, `phone`, `fields`, `provider`. */
const COPY_KEYS: Record<string, string[]> = {
  hero: ["eyebrow", "headline", "subtext", "button_label"],
  stats: ["items.*.value", "items.*.label"],
  text: ["heading", "body"],
  image_text: ["heading", "body", "button_label"],
  reviews: ["title", "items.*.quote", "items.*.name"],
  newsletter: ["title", "intro", "button_label", "success"],
  quote: ["quote", "name"],
  faq: ["title", "items.*.question", "items.*.answer"],
  price_list: ["title", "subtitle", "sections.*.name", "sections.*.items.*.name", "sections.*.items.*.description", "sections.*.items.*.badge"],
  hours: ["title", "rows.*.label", "rows.*.value"],
  contact_form: ["title", "submit_label"],
  event_calendar: ["title"],
  product_list: ["title"],
  gallery: ["title"],
  map: ["title"],
  audio: ["title", "note"],
  share: ["title"],
  button: ["label"],
};

/** How long each kind of field may be, by its last key. Matches the inspector's own limits. */
const MAX_BY_FIELD: Record<string, number> = {
  eyebrow: 40,
  headline: 80,
  subtext: 200,
  button_label: 30,
  submit_label: 30,
  label: 30,
  value: 14,
  heading: 80,
  title: 60,
  subtitle: 160,
  body: 2000,
  intro: 160,
  success: 120,
  quote: 300,
  name: 60,
  question: 120,
  answer: 500,
  description: 160,
  badge: 20,
  note: 160,
};

export interface CopyField {
  key: string;
  text: string;
  max: number;
  set: (value: string) => void;
}

/** Every copy field of the starter, with a setter. Keys are `page/block/path`, e.g. `0/0/headline`, `0/3/items/1/quote`. */
export function collectCopy(starter: Starter): CopyField[] {
  const fields: CopyField[] = [];
  starter.pages.forEach((page, pi) => {
    page.blocks.forEach((block, bi) => {
      for (const pattern of COPY_KEYS[block.type] ?? []) {
        walk(block.config as Record<string, unknown>, pattern.split("."), `${pi}/${bi}`, fields);
      }
    });
  });
  return fields;
}

function walk(node: unknown, path: string[], key: string, out: CopyField[]) {
  if (node === null || typeof node !== "object") return;
  const [head, ...rest] = path;
  if (head === "*") {
    if (!Array.isArray(node)) return;
    node.forEach((item, i) => walk(item, rest, `${key}/${i}`, out));
    return;
  }
  const obj = node as Record<string, unknown>;
  if (rest.length === 0) {
    const text = obj[head];
    if (typeof text === "string" && text.trim()) {
      out.push({
        key: `${key}/${head}`,
        text,
        max: MAX_BY_FIELD[head] ?? 120,
        set: (value) => {
          obj[head] = value;
        },
      });
    }
    return;
  }
  walk(obj[head], rest, `${key}/${head}`, out);
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
    const values = reply as Record<string, unknown>;
    let changed = 0;
    for (const field of fields) {
      const raw = values[field.key];
      // A nested {"text": …} is tolerated, since that is the shape we sent.
      const text = typeof raw === "string" ? raw : raw && typeof raw === "object" && typeof (raw as { text?: unknown }).text === "string" ? (raw as { text: string }).text : null;
      if (text === null) continue;
      const next = sanitize(text, field.max);
      if (!next || next === field.text) continue;
      field.set(next);
      changed += 1;
    }
    return changed > 0 ? { starter, source: "ai", changed } : { starter, source: "template", changed: 0, note: "the model changed nothing" };
  } catch (error) {
    return { starter, source: "template", changed: 0, note: error instanceof Error ? error.message : "the model call failed" };
  }
}

/** Plain text only: no control characters, no tags, trimmed to the field's limit on a word boundary where possible. */
function sanitize(text: string, max: number): string {
  let out = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<[^>]*>/g, "").trim();
  if (out.length > max) {
    const cut = out.slice(0, max);
    const space = cut.lastIndexOf(" ");
    out = (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
  }
  return out;
}
