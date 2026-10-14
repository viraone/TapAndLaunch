/**
 * The link between a piece of text on the page and its box in the inspector. Both carry the same field key (the
 * path into the block's config, like `headline` or `items.2.label`) as `data-field`; focusing either one announces
 * it, and the other side lights up and scrolls into view, so it is obvious they are the same thing.
 */
export const FIELD_FOCUS_EVENT = "builder-field-focus";
export const FIELD_HOT_ATTR = "data-field-hot";
/** How long the other side stays lit after a focus. */
export const FIELD_HOT_MS = 1600;

export interface FieldFocusDetail {
  key: string;
  source: "page" | "inspector";
}

export function fieldKey(path: Array<string | number>): string {
  return path.join(".");
}

export function announceField(key: string, source: FieldFocusDetail["source"]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FieldFocusDetail>(FIELD_FOCUS_EVENT, { detail: { key, source } }));
}

/** Props for an inspector input that edits `path`: the key, and the announcement on focus. */
export function linked(path: Array<string | number> | string): { "data-field": string; onFocus: () => void } {
  const key = typeof path === "string" ? path : fieldKey(path);
  return { "data-field": key, onFocus: () => announceField(key, "inspector") };
}

/** Lights `el` for a moment and scrolls it into view. */
export function flashField(el: HTMLElement): void {
  el.setAttribute(FIELD_HOT_ATTR, "true");
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  window.setTimeout(() => el.removeAttribute(FIELD_HOT_ATTR), FIELD_HOT_MS);
}
