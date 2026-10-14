/**
 * The words of a block, as a flat list of fields the AI may rewrite. Shared by every AI feature that changes copy
 * (the new-site rewrite, Cmd+K on a section, the agent's `set_words`, the paste inbox): one list of which keys are
 * words, one list of how long each may be, one sanitiser. Nothing else about a block is ever sent to or taken from
 * a model: not `image_url`, `src`, `url`, `button_page`, `address`, `phone`, `fields`, `provider`.
 */

/** The copy fields of each block type, by config key (`items.*.quote` means every item's quote). */
export const COPY_KEYS: Record<string, string[]> = {
  hero: ["eyebrow", "headline", "subtext", "button_label"],
  stats: ["items.*.value", "items.*.label"],
  text: ["heading", "body"],
  image_text: ["heading", "body", "button_label"],
  image: ["caption", "alt"],
  reviews: ["title", "items.*.quote", "items.*.name"],
  newsletter: ["title", "intro", "button_label", "success"],
  quote: ["quote", "name"],
  faq: ["title", "items.*.question", "items.*.answer"],
  price_list: ["title", "subtitle", "sections.*.name", "sections.*.items.*.name", "sections.*.items.*.description", "sections.*.items.*.badge"],
  hours: ["title", "rows.*.label", "rows.*.value"],
  contact_form: ["title", "submit_label"],
  event_calendar: ["title"],
  product_list: ["title"],
  gallery: ["title", "images.*.alt"],
  map: ["title"],
  audio: ["title", "note"],
  share: ["title"],
  button: ["label"],
  files: ["title", "intro", "items.*.label", "items.*.note"],
  video: ["title", "caption"],
  zoom_meeting: ["title", "description"],
  listing_directory: ["title"],
  gas_directory: ["title", "fallback_label"],
  food_directory: ["title", "subtitle", "fallback_label"],
  canva_embed: ["button_label"],
  class_finder: ["title", "subtitle", "area_label"],
  open_mic_signup: ["title"],
};

/** How long each kind of field may be, by its last key. Matches the inspector's own limits. */
export const MAX_BY_FIELD: Record<string, number> = {
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
  caption: 160,
  alt: 120,
};

export interface CopyField {
  /** `headline`, `items/1/quote`, or with a prefix `0/3/items/1/quote`. */
  key: string;
  text: string;
  max: number;
  set: (value: string) => void;
}

/** Every copy field of one block's config, with a setter that changes the config in place. */
export function collectConfigCopy(type: string, config: Record<string, unknown>, prefix = ""): CopyField[] {
  const fields: CopyField[] = [];
  for (const pattern of COPY_KEYS[type] ?? []) walk(config, pattern.split("."), prefix, fields, true);
  return fields;
}

/**
 * Like `collectConfigCopy`, but empty fields count too (so an instruction can fill in a blank eyebrow or caption).
 * Only fields whose parent exists; it never invents items.
 */
export function collectConfigCopyWithBlanks(type: string, config: Record<string, unknown>, prefix = ""): CopyField[] {
  const fields: CopyField[] = [];
  for (const pattern of COPY_KEYS[type] ?? []) walk(config, pattern.split("."), prefix, fields, false);
  return fields;
}

function walk(node: unknown, path: string[], key: string, out: CopyField[], skipBlank: boolean) {
  if (node === null || typeof node !== "object") return;
  const [head, ...rest] = path;
  const join = (k: string) => (key ? `${key}/${k}` : k);
  if (head === "*") {
    if (!Array.isArray(node)) return;
    node.forEach((item, i) => walk(item, rest, join(String(i)), out, skipBlank));
    return;
  }
  const obj = node as Record<string, unknown>;
  if (rest.length === 0) {
    const text = obj[head];
    const isString = typeof text === "string";
    // Blank fields are included only when asked for; a value that is not text (a number, a list) is never copy.
    if (skipBlank ? !isString || !(text as string).trim() : text !== undefined && text !== null && !isString) return;
    out.push({
      key: join(head),
      text: typeof text === "string" ? text : "",
      max: MAX_BY_FIELD[head] ?? 120,
      set: (value) => {
        obj[head] = value;
      },
    });
    return;
  }
  walk(obj[head], rest, join(head), out, skipBlank);
}

/** Whether `path` (like `items.2.quote`) is a copy field of this block type. */
export function isCopyPath(type: string, path: string): boolean {
  const parts = path.split(/[./]/);
  return (COPY_KEYS[type] ?? []).some((pattern) => {
    const p = pattern.split(".");
    if (p.length !== parts.length) return false;
    return p.every((seg, i) => (seg === "*" ? /^\d+$/.test(parts[i]) : seg === parts[i]));
  });
}

/** The limit for a field, by the last segment of its path. */
export function maxForPath(path: string): number {
  const last = path.split(/[./]/).pop() ?? "";
  return MAX_BY_FIELD[last] ?? 120;
}

/** Plain text only: no control characters, no tags, trimmed to the field's limit on a word boundary where possible. */
export function sanitize(text: string, max: number): string {
  let out = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<[^>]*>/g, "").trim();
  if (out.length > max) {
    const cut = out.slice(0, max);
    const space = cut.lastIndexOf(" ");
    out = (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
  }
  return out;
}

/** The model's value for a field: a string, or the `{"text": …}` shape we send it. */
export function readModelText(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && typeof (raw as { text?: unknown }).text === "string") return (raw as { text: string }).text;
  return null;
}
