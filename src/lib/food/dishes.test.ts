import { describe, expect, it } from "vitest";
import { CUISINE_KEYS } from "@/lib/food/cuisines";
import { DISH_LISTS, extractDishes, MAX_DISHES_SHOWN } from "@/lib/food/dishes";

const r = (rating: number, text: string) => ({ rating, text });

describe("extractDishes", () => {
  it("counts each dish once per review and ranks by mentions", () => {
    const out = extractDishes(
      [
        r(5, "Best pho in Capitol Hill. The pho broth is rich, and the spring rolls are fresh."),
        r(5, "I always get the pho dac biet."),
        r(4, "Great banh mi too, and spring rolls!"),
      ],
      "vietnamese"
    );
    expect(out[0]).toEqual({ name: "Pho", emoji: "🍜", mentions: 2 });
    expect(out.find((x) => x.name === "Spring rolls")?.mentions).toBe(2);
    expect(out.find((x) => x.name === "Pho dac biet")?.mentions).toBe(1);
    expect(out.find((x) => x.name === "Banh mi")?.mentions).toBe(1);
  });

  it("ignores reviews rated below 4 stars", () => {
    const out = extractDishes([r(2, "The tonkotsu was cold and bland."), r(5, "Great miso ramen")], "ramen");
    expect(out.map((x) => x.name)).toEqual(["Miso ramen"]);
  });

  it("matches accented spellings and plurals, but not parts of other words", () => {
    expect(extractDishes([r(5, "Phở tái is perfect")], "vietnamese").map((x) => x.name)).toEqual(["Pho"]);
    expect(extractDishes([r(5, "Loved the tacos")], "mexican").map((x) => x.name)).toEqual(["Tacos"]);
    expect(extractDishes([r(5, "Amazing pastrami")], "bars")).toEqual([]);
    expect(extractDishes([r(5, "Photography on the wall was great")], "vietnamese")).toEqual([]);
  });

  it("shows at most four dishes, and none without a cuisine or usable reviews", () => {
    const many = r(5, "tonkotsu shoyu miso ramen tantanmen gyoza karaage takoyaki");
    expect(extractDishes([many], "ramen").length).toBe(MAX_DISHES_SHOWN);
    expect(extractDishes([many], null)).toEqual([]);
    expect(extractDishes([], "ramen")).toEqual([]);
    expect(extractDishes([r(5, "   ")], "ramen")).toEqual([]);
  });

  it("has a dish list for every cuisine, with no empty aliases", () => {
    for (const key of CUISINE_KEYS) {
      expect(DISH_LISTS[key].length).toBeGreaterThan(5);
      for (const dish of DISH_LISTS[key]) {
        expect(dish.aliases.length).toBeGreaterThan(0);
        for (const a of dish.aliases) expect(a).toBe(a.toLowerCase().trim());
      }
    }
  });
});
