import type { CuisineKey } from "@/types/database";

/**
 * The cuisine quick-filters LiveBites offers. Each maps to the Google
 * Places (New) types used to *fetch* it (one Nearby Search per cuisine per
 * grid cell, made lazily the first time someone taps the pill — see
 * lib/food/nearby.ts) and to the types/keywords used to *classify* a
 * fetched place. Safe to import from client and server code.
 *
 * Order matters for classification: a place is tagged with the first
 * cuisine whose types match (a ramen shop is `ramen_restaurant` *and*
 * `japanese_restaurant`, so Ramen comes before Japanese; a burger bar is
 * `hamburger_restaurant` and `bar`, so Burgers comes before Bars).
 */
export interface CuisineDef {
  key: CuisineKey;
  label: string;
  emoji: string;
  /** Google Places (New) types to request and match on. */
  types: string[];
  /** Lower-case name fragments that also count as this cuisine. */
  keywords: string[];
}

export const CUISINES: CuisineDef[] = [
  { key: "ramen", label: "Ramen", emoji: "🍥", types: ["ramen_restaurant"], keywords: ["ramen"] },
  { key: "vietnamese", label: "Pho / Vietnamese", emoji: "🍜", types: ["vietnamese_restaurant"], keywords: ["pho", "phở", "vietnam", "banh mi", "bánh mì"] },
  { key: "thai", label: "Thai", emoji: "🍛", types: ["thai_restaurant"], keywords: ["thai"] },
  { key: "korean", label: "Korean", emoji: "🥘", types: ["korean_restaurant"], keywords: ["korean", "kbbq", "k-bbq", "bibimbap", "tofu house"] },
  { key: "japanese", label: "Japanese", emoji: "🍣", types: ["japanese_restaurant", "sushi_restaurant"], keywords: ["sushi", "izakaya", "japanese", "teriyaki", "udon", "tonkatsu", "yakitori"] },
  { key: "mexican", label: "Mexican / Tacos", emoji: "🌮", types: ["mexican_restaurant"], keywords: ["taco", "taqueria", "birria", "burrito", "mexican", "cantina"] },
  { key: "pizza", label: "Pizza", emoji: "🍕", types: ["pizza_restaurant"], keywords: ["pizza", "pizzeria"] },
  { key: "burgers", label: "Burgers", emoji: "🍔", types: ["hamburger_restaurant", "fast_food_restaurant"], keywords: ["burger", "dick's drive"] },
  {
    key: "mediterranean",
    label: "Mediterranean",
    emoji: "🥙",
    types: ["mediterranean_restaurant", "middle_eastern_restaurant", "greek_restaurant", "lebanese_restaurant", "turkish_restaurant"],
    keywords: ["gyro", "falafel", "shawarma", "kebab", "kabob", "mediterranean", "halal", "hummus"],
  },
  // Google has no ethiopian_restaurant type; African + the names do the work.
  { key: "ethiopian", label: "Ethiopian", emoji: "🫓", types: ["african_restaurant"], keywords: ["ethiopian", "eritrean", "injera", "habesha", "abyssinia", "addis"] },
  { key: "indian", label: "Indian", emoji: "🍛", types: ["indian_restaurant"], keywords: ["indian", "curry", "tikka", "biryani", "tandoor", "masala", "dosa"] },
  { key: "bars", label: "Bars & Pub Grub", emoji: "🍻", types: ["bar", "pub", "bar_and_grill"], keywords: ["tavern", "pub", "taproom", "brewery", "saloon", "bait shop"] },
  {
    key: "dessert",
    label: "Dessert / Coffee",
    emoji: "☕",
    types: ["coffee_shop", "cafe", "dessert_shop", "ice_cream_shop", "bakery", "tea_house"],
    keywords: ["boba", "bubble tea", "coffee", "espresso", "ice cream", "gelato", "dessert", "bakery", "donut", "doughnut", "creamery"],
  },
];

export const CUISINE_KEYS = CUISINES.map((c) => c.key) as [CuisineKey, ...CuisineKey[]];

export const CUISINE_BY_KEY: Record<CuisineKey, CuisineDef> = Object.fromEntries(
  CUISINES.map((c) => [c.key, c])
) as Record<CuisineKey, CuisineDef>;

/** Which quick-filter a place belongs to, if any. Types win over keywords
 * (see the ordering note above); the more specific cuisine is listed first
 * in CUISINES, so it wins. */
export function cuisineOf(place: { types: string[]; primaryType?: string | null; name: string }): CuisineKey | null {
  const types = new Set([...(place.types ?? []), ...(place.primaryType ? [place.primaryType] : [])]);
  for (const c of CUISINES) if (c.types.some((t) => types.has(t))) return c.key;
  const lower = ` ${place.name.toLowerCase()} `;
  for (const c of CUISINES) if (c.keywords.some((k) => lower.includes(k))) return c.key;
  return null;
}

/** "mexican_restaurant" → "Mexican", "coffee_shop" → "Coffee shop". Used
 * as the cuisine label for places outside the quick-filters. */
export function humanizeType(type: string | null | undefined): string | null {
  if (!type) return null;
  const stripped = type.replace(/_restaurant$/, "").replace(/_/g, " ");
  if (stripped === "restaurant" || stripped === "food" || stripped === "meal takeaway" || stripped === "meal delivery") return "Restaurant";
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/** The label a card shows: the quick-filter's label when it matches,
 * otherwise a humanised primary type. */
export function cuisineLabelFor(place: { types: string[]; primaryType?: string | null; name: string }): string {
  const key = cuisineOf(place);
  if (key) return CUISINE_BY_KEY[key].label;
  const primary = humanizeType(place.primaryType);
  if (primary && primary !== "Restaurant") return primary;
  const firstCuisineType = (place.types ?? []).find((t) => t.endsWith("_restaurant") && t !== "restaurant");
  return humanizeType(firstCuisineType) ?? "Restaurant";
}
