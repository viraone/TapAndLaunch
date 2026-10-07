// Finds the vegan options on a menu the job has read (the { sections: [ { name, items: [ { name, price, description } ] } ] }
// shape saved in food_places.menu_items). Only the restaurant's own explicit labels count: a dish or a section it marks
// vegan ("Vegan Mac & Cheese", "(vegan)", "VG", "VGN", "(ve)", "V+", "*VG", "100% vegan", "plant-based", "Vegan." as its
// own sentence, a "Vegan" section), and "can be made vegan" style phrases as *on request*. The word used as an adjective on
// one ingredient ("vegan ranch" on buffalo wings, "add vegan sausage") is not a claim about the dish. "(V)" alone usually
// means vegetarian and never counts; neither do tofu or Impossible dishes with no label. Honest beats generous: a vegan
// visitor who orders from this list must not get dairy.

// A label of the whole dish, in a NAME: opens or closes it, sits in brackets, follows * or a dash, or is a tag word.
const TAG_NAME =
  /^(?:vegan|vegano|vegana|v[ée]gane?)\b|\b(?:vegan|vegano|vegana|v[ée]gane?)$|[(\[]\s*(?:vegan|vegano|vg|ve|vgn|v\+)\s*[,;/)\]]|\*\s*(?:vg|vgn|vegan)\b|[—–-]\s*vegan\s*$|\b100%\s*(?:vegan|plant[- ]based)\b|\bvgn\b|\bplant[- ]based\b|\bv[ée]g[ée]talien(?:ne)?s?\b/i;
// A label in a DESCRIPTION: "Vegan." / ", vegan" / "Vegan/" as its own clause, brackets, "*VG", "100% vegan", "is vegan",
// "fully vegan", "vegan and gluten-free". "vegan black beans" (an adjective on an ingredient) is not one.
const TAG_DESC =
  /(?:^|[.;:!,—–/-])\s*(?:vegan|vegano|vegana|v[ée]gane?)\s*(?:$|[.;,!)—–/-])|[(\[]\s*(?:vegan|vegano|vg|ve|vgn|v\+)\s*[,;/)\]]|\*\s*(?:vg|vgn|vegan)\b|\b100%\s*(?:vegan|plant[- ]based)\b|\b(?:is|are|all|fully|completely|entirely)\s+vegan\b|\bvegan\s*(?:and|&|,)\s*(?:gluten|gf|nut|soy|dairy)\b|(?:^|[.;:!,—–/-])\s*plant[- ]based\s*(?:$|[.;,!)]|\s+(?:and|&))|\bvgn\b/i;
// Bare capital tags: VG, VE, VGN, but not "VG-12" / "VE 2" (codes).
const TAG_CAPS = /\bV(?:G|E|GN)\b(?![-/ ]?\d)|(?<![\w+])V\+(?!\w)/;
// "Can be made vegan", "vegan option(s) available", "V or Ve", "(VG on request)", "sub cashew cream to make it vegan".
const ON_REQUEST =
  /\b(?:can|could|may)\s+be\s+(?:made\s+|prepared\s+)?vegan\b|\bvegan\s+(?:option|options|version|versions|upon request|on request|available|available on request|by request)\b|\bask for vegan\b|\bmake it vegan\b|\bsub(?:stitute)?\s+(?:[\w-]+\s+){0,4}(?:for|to make|to go)\s+(?:[\w-]+\s+){0,2}vegan\b|\b(?:v\s*(?:or|\/)\s*)?(?:ve|vg|vgn)\b\s*(?:option|on request|upon request|available)\b|\bv\s*(?:or|\/)\s*(?:ve|vg|vgn)\b/i;
// "not vegan", "non-vegan", "no vegan options", "cannot be made vegan". Deliberately narrow: "non-dairy vegan ice cream"
// and "not your average vegan burger" are vegan.
const NEGATED =
  /\b(?:no|not|non|isn'?t|aren'?t|never)[- ]vegan\b|\bnon[- ]?vegan\b|\bnot\s+(?:a\s+|entirely\s+|fully\s+)?vegan\b|\bno\s+vegan\s+(?:options?|items?|dishes?|menu)\b|\bvegan\s+(?:options?|items?|dishes?)\s+(?:are\s+)?not\s+available\b|\b(?:cannot|can'?t|unable to)\s+be\s+(?:made\s+)?vegan\b|\bno\s+vegano\b|\bpas\s+v[ée]gane?\b/i;
// A vegan / plant-based stand-in for an animal ingredient, blanked before the animal check so it never counts as the animal
// it replaces: "vegan sausage", "Beyond patty", "tofu-based pork skin", "coconut milk".
const SWAP =
  /\b(?:non[- ]dairy|dairy[- ]free|egg[- ]free|meat[- ]free|[\w]+[- ]less)\b|\b(?:vegan|vegetarian|veggie|plant[- ]based|tofu[- ]based|soy[- ]based|mock|beyond|impossible|soy|oat|almond|coconut|cashew|rice|nut|dairy[- ]free|non[- ]dairy)\s+(?:(?:white|sweet|smoked|crispy|spicy|fried|style)\s+)?["“”']?(?:milk|cream|creamer|cheese|cheddar|mozzarella|parmesan|feta|butter|yogh?urt|meat|patty|patties|burger|sausages?|bacon|chicken|beef|pork|fish|crab|eggs?|mayo|mayonnaise|aioli|ranch|chorizo|ham|shrimp|tuna|jerky|steak|nuggets?|skin|protein|cheddar|honey|whey)["“”']?/gi;
const ANIMAL =
  /\b(?:eggs?|bacon|sausages?|cheese|cheddar|mozzarella|parmesan|feta|paneer|pork|carnitas|chicken|beef|steak|spam|shrimp|prawns?|fish|salmon|tuna|crab|lobster|clams?|oysters?|mussels?|scallops?|squid|calamari|octopus|anchov(?:y|ies)|ham|lamb|turkey|duck|butter|ghee|milk|cream|honey|yogh?urt|mayo|mayonnaise|aioli|ranch|lard|chorizo|pepperoni|salami|prosciutto|pastrami|brisket|katsu|tonkotsu|gelatin|whey|dairy)\b/i;
const MAX_ITEMS = 12;

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const key = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hasAnimal = (text) => ANIMAL.test(String(text ?? "").replace(SWAP, " "));
const taggedName = (t) => TAG_NAME.test(t) || TAG_CAPS.test(t);
// The word used as an adjective on the dish itself ("the vegan phở", "non-dairy vegan lentils", "a vegan take on the
// classic") counts when nothing animal is left once stand-ins are blanked; on a meat dish ("vegan ranch" with wings) it does not.
const WORD = /\b(?:vegan|vegano|vegana|v[ée]gane?)\b/i;
const taggedDesc = (t) => TAG_DESC.test(t) || TAG_CAPS.test(t);

/**
 * @param {{ sections?: { name?: string; items?: { name?: string; price?: string | null; description?: string | null }[] }[] } | null | undefined} menu
 * @returns {{ status: "found" | "none"; items: { name: string; section: string | null; price: string | null; note?: string }[] }}
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
    const row = { name, section: clean(section) || null, price: clean(item.price) || null };
    if (note) row.note = note;
    out.push(row);
  };
  for (const section of menu?.sections ?? []) {
    const sectionName = clean(section?.name);
    // A "Vegan" / "Vegan & Gluten-Free" section vouches for everything in it; a mixed "Vegetarian & Vegan" or "(V/VG)"
    // one does not, and neither does a note like "Mains (vegan options on request)".
    const wholeSection =
      taggedName(sectionName) && !NEGATED.test(sectionName) && !ON_REQUEST.test(sectionName) && !/\bvegetarian\b|\bveggie\b|\(\s*v\s*\)|\bv\s*\/|\/\s*v\b/i.test(sectionName);
    for (const item of section?.items ?? []) {
      const name = clean(item?.name);
      const description = clean(item?.description);
      const text = `${name} ${description}`;
      if (NEGATED.test(text)) continue;
      if (wholeSection) add(item, sectionName);
      // The dish's own name says it: "Vegan Mac & Cheese", "Tofu Banh Mi (VG)". A name that merely lists a vegan choice
      // next to meat ("Bacon, sausage, Beyond vegan sausage") is not tagged and is not vegan.
      else if (taggedName(name) && !ON_REQUEST.test(name)) add(item, sectionName);
      else if (ON_REQUEST.test(text)) add(item, sectionName, "on request");
      // "Vegan." as its own word in the blurb is a label; "vegan ranch" next to buffalo wings is not.
      else if (taggedDesc(description)) add(item, sectionName);
      else if (WORD.test(text) && !hasAnimal(text)) add(item, sectionName);
    }
  }
  // Dishes that are vegan ahead of "can be made vegan" ones, menu order kept within each; then the cap.
  out.sort((a, b) => (a.note ? 1 : 0) - (b.note ? 1 : 0));
  const items = out.slice(0, MAX_ITEMS);
  return { status: items.length ? "found" : "none", items };
}
