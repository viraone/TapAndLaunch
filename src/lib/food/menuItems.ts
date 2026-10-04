/**
 * A restaurant's menu as saved by the menu job (tools/menu-ingest), and the small helpers the app needs to
 * show it. The job already cleans the data; parseMenu re-checks the shape anyway, because it comes from a
 * database column that anything with the service key could write.
 */
export interface MenuItem {
  name: string;
  price: string | null;
  description: string | null;
}

export interface MenuSection {
  name: string;
  items: MenuItem[];
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

/** The saved menu, or null when it is missing or not in the expected shape. Drops malformed items. */
export function parseMenu(raw: unknown): MenuSection[] | null {
  const sections = (raw as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(sections)) return null;
  const out: MenuSection[] = [];
  for (const s of sections.slice(0, 40)) {
    const items: MenuItem[] = [];
    const list = (s as { items?: unknown } | null)?.items;
    if (!Array.isArray(list)) continue;
    for (const i of list.slice(0, 400)) {
      const name = text((i as { name?: unknown })?.name, 90);
      if (!name) continue;
      items.push({ name, price: text((i as { price?: unknown }).price, 12), description: text((i as { description?: unknown }).description, 140) });
    }
    if (items.length) out.push({ name: text((s as { name?: unknown }).name, 60) ?? "Menu", items });
  }
  return out.length ? out : null;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Sections with only the items whose name, description or section matches every word typed. Empty query: everything. */
export function filterMenu(sections: MenuSection[], query: string): MenuSection[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return sections;
  const out: MenuSection[] = [];
  for (const s of sections) {
    const sectionText = norm(s.name);
    const items = s.items.filter((i) => {
      const hay = `${sectionText} ${norm(i.name)} ${norm(i.description ?? "")}`;
      return words.every((w) => hay.includes(w));
    });
    if (items.length) out.push({ name: s.name, items });
  }
  return out;
}
