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
// A vegan claim in a DESCRIPTION is only about the dish when the dish has no animal ingredients. "Scrambled egg, cheddar.
// Add bacon, sausage, vegan sausage" is an egg sandwich with a vegan add-on, and "2 Spam & Egg, 2 Vegan Vortex" is a tray
// that happens to include a vegan item. Swapped-in things ("vegan sausage", "Beyond patty", "tofu-based pork skin",
// "coconut milk") are blanked before the check, so they never count as the animal they replace.
const SWAP = /\b(vegan|vegetarian|veggie|vegetable|plant[- ]based|tofu[- ]based|soy[- ]based|mock|beyond|impossible|soy|oat|almond|coconut|cashew|rice|nut|dairy[- ]free|non[- ]dairy)\s+(?:[\w-]+\s+)?["“”']?[\w-]+["“”']?/gi;
const ANIMAL = /\b(eggs?|bacon|sausages?|cheese|cheddar|mozzarella|parmesan|feta|pork|chicken|beef|spam|shrimp|prawns?|fish|salmon|tuna|crab|lobster|clams?|oysters?|anchov(?:y|ies)|ham|lamb|turkey|duck|butter|milk|cream|honey|yogh?urt|mayo|mayonnaise|aioli|lard|chorizo|pepperoni|salami|prosciutto|brisket|katsu|tonkotsu|gelatin)\b/i;
const hasAnimal = (text) => ANIMAL.test(String(text ?? "").replace(SWAP, " "));

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
      const name = clean(item?.name);
      const description = clean(item?.description);
      const text = `${name} ${description}`;
      if (NEGATED.test(text)) continue;
      if (wholeSection) add(item, sectionName);
      // "Can be made vegan" dishes list their meat defaults by nature, so the animal check does not apply.
      else if (ON_REQUEST.test(text)) add(item, sectionName, "on request");
      // The restaurant put the word in the dish's own name: trust it, unless the name itself is a list of choices with
      // meat in it ("Bacon, sausage, Beyond vegan sausage").
      else if (claims(name)) {
        if (!hasAnimal(name)) add(item, sectionName);
      }
      // A claim only in the description must be about the whole dish, not a swapped-in or added ingredient.
      else if (claims(description) && !hasAnimal(text)) add(item, sectionName);
    }
  }
  const items = out.slice(0, MAX_ITEMS);
  return { status: items.length ? "found" : "none", items };
}
