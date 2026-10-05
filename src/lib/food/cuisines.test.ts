import { describe, expect, it } from "vitest";
import { CUISINES, CUISINE_KEYS, cuisineLabelFor, cuisineOf } from "@/lib/food/cuisines";

describe("cuisines", () => {
  it("offers the fifteen quick-filters in display order", () => {
    expect(CUISINE_KEYS).toEqual([
      "ramen", "vietnamese", "thai", "korean", "taiwanese", "japanese",
      "mexican", "pizza", "burgers", "mediterranean", "ethiopian", "indian", "bars", "ice_cream", "dessert",
    ]);
    expect(new Set(CUISINES.map((c) => c.emoji)).size).toBe(CUISINES.length);
  });

  it("classifies by Google type, most specific first", () => {
    expect(cuisineOf({ types: ["ramen_restaurant", "japanese_restaurant", "restaurant"], name: "Kizuki" })).toBe("ramen");
    expect(cuisineOf({ types: ["japanese_restaurant", "restaurant"], name: "Aoki Sushi & Grill" })).toBe("japanese");
    expect(cuisineOf({ types: ["hamburger_restaurant", "bar", "restaurant"], name: "Local Bigger Burger" })).toBe("burgers");
    expect(cuisineOf({ types: ["bar", "restaurant"], name: "Linda's Tavern" })).toBe("bars");
    expect(cuisineOf({ types: ["coffee_shop", "cafe"], name: "Victrola" })).toBe("dessert");
    expect(cuisineOf({ types: ["ice_cream_shop", "dessert_shop", "food"], primaryType: "ice_cream_shop", name: "Molly Moon's Homemade Ice Cream" })).toBe("ice_cream");
    // With no Google type to go on, the name decides.
    expect(cuisineOf({ types: ["food"], name: "Seattle Gelato Co" })).toBe("ice_cream");
    expect(cuisineOf({ types: ["pizza_restaurant", "italian_restaurant"], name: "Big Mario's" })).toBe("pizza");
    // Din Tai Fung is tagged taiwanese, dim sum, cantonese and chinese: Google's primary type decides.
    expect(cuisineOf({ types: ["taiwanese_restaurant", "dim_sum_restaurant", "chinese_restaurant"], primaryType: "taiwanese_restaurant", name: "Din Tai Fung" })).toBe("taiwanese");
    expect(cuisineOf({ types: ["restaurant", "food"], name: "Taipei Noodle House" })).toBe("taiwanese");
    expect(cuisineOf({ types: ["greek_restaurant"], name: "The Golden Olive" })).toBe("mediterranean");
  });

  it("trusts Google's primary type over its other tags", () => {
    // An Indian street-food spot Google also tags mexican_restaurant (Desi Adda, Redmond).
    expect(cuisineOf({ types: ["mexican_restaurant", "indian_restaurant", "restaurant"], primaryType: "indian_restaurant", name: "Desi Adda" })).toBe("indian");
    // A primary type that isn't a quick-filter falls through to the other tags.
    expect(cuisineOf({ types: ["thai_restaurant", "restaurant"], primaryType: "restaurant", name: "Kin Dee" })).toBe("thai");
  });

  it("falls back to name keywords when Google has no matching type", () => {
    expect(cuisineOf({ types: ["restaurant"], name: "Habesha Restaurant" })).toBe("ethiopian");
    expect(cuisineOf({ types: ["restaurant"], name: "Tacos Chukis" })).toBe("mexican");
    expect(cuisineOf({ types: ["restaurant"], name: "Pho Bac" })).toBe("vietnamese");
    expect(cuisineOf({ types: ["restaurant"], name: "Aladdin Gyro-cery" })).toBe("mediterranean");
    expect(cuisineOf({ types: ["restaurant"], name: "Altura" })).toBeNull();
  });

  it("labels unmatched places by their primary type", () => {
    expect(cuisineLabelFor({ types: ["italian_restaurant", "restaurant"], primaryType: "italian_restaurant", name: "Altura" })).toBe("Italian");
    expect(cuisineLabelFor({ types: ["restaurant"], primaryType: "restaurant", name: "Cafe Lolo" })).toBe("Restaurant");
  });
});
