// Finds the vegan options on a menu the job has read (the { sections: [ { name, items: [ { name, description } ] } ] }
// shape saved in food_places.menu_items). Only the restaurant's own explicit claims count: an item or a section it
// labels vegan ("vegan", "VG", "VGN", "(ve)", "plant-based", "can be made vegan"). "(V)" on its own usually means
// vegetarian and is not counted; neither are tofu or Impossible dishes with no label. Honest beats generous: a vegan
// visitor who orders from this list must not get dairy.

// Tags in any case ("vegan", "VGN", "(vg)", "[VE]", "plant-based"); a bare "VG" only in capitals, so "vg" inside prose is not one.
const LABEL = /\bvegan\b|\bvgn\b|\bplant[- ]based\b|\(\s*v[ge]\s*\)|\[\s*v[ge]\s*\]/i;
const LABEL_CAPS = /\bVG\b/;
const ON_REQUEST = /\b(can|could) be (made )?vegan\b|\bvegan (option|version|upon request|on request|available|available on request)\b|\bask for vegan\b|\bmake it vegan\b|\bsub(stitute)? .{0,30}\bvegan\b/i;
// "no vegan options", "not vegan", "non-vegan", "isn't vegan", "we cannot guarantee … vegan"
const NEGATED = /\b(no|not|non|isn'?t|aren'?t|never|without)[- ](?:\w+ ){0,2}vegan\b|\bvegan[- ](?:dishes|options|items) (?:are )?not\b|cannot guarantee|can'?t guarantee|not guaranteed/i;
const MAX_ITEMS = 12;

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const key = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Does this text carry the restaurant's own vegan claim? ("vegan" alone, case-insensitively, or a vegan tag). */
function claims(text) {
  if (!text) return false;
  if (NEGATED.test(text)) return false;
  return LABEL.test(text) || LABEL_CAPS.test(text);
}

/**
 * @param {{ sections?: { name?: string; items?: { name?: string; description?: string | null }[] }[] } | null | undefined} menu
 * @returns {{ status: "found" | "none"; items: { name: string; section: string | null; note?: string }[] }}
 */
export function findVeganOptions(menu) {
  const out = [];
  const seen = new Set();
  const add = (item, section, note) => {
    const name = clean(item.name);
    if (!name) return;
    const k = key(name);
    if (!k || seen.has(k)) return;
    seen.add(k);
    const row = { name, section: clean(section) || null };
    if (note) row.note = note;
    out.push(row);
  };
  for (const section of menu?.sections ?? []) {
    const sectionName = clean(section?.name);
    // A "Vegan" section vouches for everything in it; a mixed "Vegetarian & Vegan" section does not.
    const wholeSection = claims(sectionName) && !/\bvegetarian\b|\bveggie\b/i.test(sectionName);
    for (const item of section?.items ?? []) {
      const text = `${clean(item?.name)} ${clean(item?.description)}`;
      if (NEGATED.test(text)) continue;
      if (wholeSection) add(item, sectionName);
      else if (ON_REQUEST.test(text)) add(item, sectionName, "on request");
      else if (claims(text)) add(item, sectionName);
    }
  }
  const items = out.slice(0, MAX_ITEMS);
  return { status: items.length ? "found" : "none", items };
}
