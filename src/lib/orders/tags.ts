export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 24;

/**
 * Cleans a tag typed by hand: commas are dropped (the tag input uses a comma
 * to commit a tag), runs of whitespace become one space, and the result is
 * lowercased so `VIP` and `vip` are the same tag. Returns null when nothing
 * usable is left or the cleaned tag is too long.
 */
export function normalizeTag(raw: string): string | null {
  const tag = raw
    .replace(/,/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (tag === "" || tag.length > MAX_TAG_LENGTH) return null;
  return tag;
}

/** Normalizes and de-duplicates a tag list, keeping the first spelling of
 * each tag, the original order, and at most MAX_TAGS tags. */
export function normalizeTags(raw: string[]): string[] {
  const tags: string[] = [];

  for (const value of raw) {
    const tag = normalizeTag(value);
    if (tag === null || tags.includes(tag)) continue;
    tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }

  return tags;
}
