import { describe, expect, it } from "vitest";
import { CUISINES, CUISINE_KEYS, cuisineLabelFor, cuisineOf } from "@/lib/food/cuisines";

describe("cuisines", () => {
  it("offers the thirteen quick-filters in display order", () => {
    expect(CUISINE_KEYS).toEqual([
      "ramen", "vietnamese", "thai", "korean", "japanese",
      "mexican", "pizza", "burgers", "mediterranean", "ethiopian", "indian", "bars", "dessert",
    ]);
    expect(new Set(CUISINES.map((c) => c.emoji)).size).toBe(CUISINES.length);
  });

  it("classifies by Google type, most specific first", () => {
    expect(cuisineOf({ types: ["ramen_restaurant", "japanese_restaurant", "restaurant"], name: "Kizuki" })).toBe("ramen");
    expect(cuisineOf({ types: ["japanese_restaurant", "restaurant"], name: "Aoki Sushi & Grill" })).toBe("japanese");
    expect(cuisineOf({ types: ["hamburger_restaurant", "bar", "restaurant"], name: "Local Bigger Burger" })).toBe("burgers");
    expect(cuisineOf({ types: ["bar", "restaurant"], name: "Linda's Tavern" })).toBe("bars");
    expect(cuisineOf({ types: ["coffee_shop", "cafe"], name: "Victrola" })).toBe("dessert");
    expect(cuisineOf({ types: ["pizza_restaurant", "italian_restaurant"], name: "Big Mario's" })).toBe("pizza");
    expect(cuisineOf({ types: ["greek_restaurant"], name: "The Golden Olive" })).toBe("mediterranean");
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
