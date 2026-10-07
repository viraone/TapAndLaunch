import { describe, expect, it } from "vitest";
import { findVeganOptions } from "./vegan.mjs";

const menu = (sections) => ({ sections });
const item = (name, description = null, price = null) => ({ name, price, description });
const names = (r) => r.items.map((i) => i.name + (i.note ? ` [${i.note}]` : ""));

describe("findVeganOptions", () => {
  it("counts every item in a section the restaurant calls vegan, including Vegan & Gluten-Free and Vegano", () => {
    const r = findVeganOptions(
      menu([
        { name: "Vegan", items: [item("Jackfruit tacos"), item("Cauliflower wings")] },
        { name: "Vegan & Gluten-Free", items: [item("Quinoa bowl")] },
        { name: "Vegano", items: [item("Tacos de jaca")] },
      ])
    );
    expect(r.status).toBe("found");
    expect(names(r)).toEqual(["Jackfruit tacos", "Cauliflower wings", "Quinoa bowl", "Tacos de jaca"]);
    expect(r.items[0].section).toBe("Vegan");
  });

  it("does not let a mixed, negated or on-request section name vouch for its dishes", () => {
    const r = findVeganOptions(
      menu([
        { name: "Vegetarian & Vegan", items: [item("Veggie burger"), item("Vegan burger")] },
        { name: "Desserts (V/VG)", items: [item("Cheesecake")] },
        { name: "Mains (vegan options available on request)", items: [item("Ribeye steak", "12oz, garlic butter")] },
        { name: "Non-Vegan", items: [item("Pork belly")] },
      ])
    );
    expect(names(r)).toEqual(["Vegan burger"]);
  });

  it("reads the dish's own tags in any case, not the vegetarian (V) tag or unlabelled tofu", () => {
    const r = findVeganOptions(
      menu([
        {
          name: "Mains",
          items: [
            item("Tofu Banh Mi (VG)"),
            item("Tofu curry (V)"),
            item("Mapo tofu"),
            item("Garden bowl", "VGN, gluten free"),
            item("Lentil soup", "Plant-based and hearty"),
            item("Impossible burger"),
            item("Tofu curry VE"),
            item("Beet burger V+"),
            item("Vegan Vortex *VG"),
            item("Code VG-12 Combo"),
          ],
        },
      ])
    );
    expect(names(r)).toEqual(["Tofu Banh Mi (VG)", "Garden bowl", "Lentil soup", "Tofu curry VE", "Beet burger V+", "Vegan Vortex *VG"]);
  });

  it("trusts a labelled dish even when its name mentions cheese, egg, butter or milk", () => {
    const r = findVeganOptions(
      menu([
        {
          name: "Comfort",
          items: [
            item("Vegan Mac & Cheese"),
            item("Mac & Cheese (vegan)"),
            item("Peanut Butter Cookie (vegan)"),
            item("Golden Milk Latte (vegan)"),
            item("Crab-less Cakes (vegan)"),
            item("Vegetarian Miso Ramen", "Vegan. Miso soup with mushrooms, corn butter, tofu skin"),
            item("Chocolate torte", "Rich chocolate and peanut butter. Vegan."),
            item("Coconut ice cream", "vegan; oat-based ice cream"),
            item("Dal", "Non-dairy vegan lentils"),
            item("The Big Green", "Not your average vegan burger"),
          ],
        },
      ])
    );
    expect(names(r)).toEqual([
      "Vegan Mac & Cheese",
      "Mac & Cheese (vegan)",
      "Peanut Butter Cookie (vegan)",
      "Golden Milk Latte (vegan)",
      "Crab-less Cakes (vegan)",
      "Vegetarian Miso Ramen",
      "Chocolate torte",
      "Coconut ice cream",
      "Dal",
      "The Big Green",
    ]);
  });

  it("does not count a meat dish because a vegan ingredient, add-on or tray item is mentioned", () => {
    const r = findVeganOptions(
      menu([
        { name: "Savory", items: [item("Classic Egg Sammy (Vegetarian)", "Scrambled egg, Tillamook cheddar. Add bacon, sausage, vegan sausage $3"), item("Carnivore", "Breakfast sausage, white cheddar. Add Beyond vegan patty $3")] },
        { name: "Bánh Mì", items: [item("[Tray] Banh Mi Variety Box", "2 Piggy, 2 Bok Bok, 2 Spam & Egg, 2 Vegan Vortex"), item("Vegan Vortex *VG", "Tofu, pickled carrot, vegan mayo")] },
        { name: "Sides", items: [item("Bacon, sausage, Beyond vegan sausage"), item("PLANT-BASED SWEET PORK")] },
        { name: "Bar", items: [item("Buffalo Wings", "Served with ranch or vegan ranch."), item("Fried Calamari", "Crispy squid rings with vegan aioli."), item("Carnitas Bowl", "Slow-cooked carnitas, vegan black beans, cheddar")] },
        { name: "Pizza", items: [item("Pepperoni", "add vegan cheese +$2"), item("Bacon burger", "beef, bacon, cheddar; sub vegan cheese +$1")] },
      ])
    );
    expect(names(r)).toEqual(["Vegan Vortex *VG", "PLANT-BASED SWEET PORK"]);
  });

  it("marks dishes the kitchen can make vegan as on request, and puts them after the firm ones", () => {
    const r = findVeganOptions(
      menu([
        {
          name: "Noodles",
          items: [
            item("Pad Thai", "Chicken, shrimp or tofu. Can be made vegan.", "$16"),
            item("Mushroom risotto (V, VG on request)"),
            item("Foul (V or Ve Option)", "Fava beans, feta cheese, eggs"),
            item("Mac & cheese (v) (vg on request)"),
            item("Vegetarian Miso Ramen", "Vegan option available. Miso soup, corn butter"),
            item("Curry", "sub cashew cream to make it vegan"),
            item("Vegan Pho", "vegan available all day"),
            item("Veggie Sub (vegan)"),
          ],
        },
      ])
    );
    expect(names(r)).toEqual([
      "Vegan Pho",
      "Veggie Sub (vegan)",
      "Pad Thai [on request]",
      "Mushroom risotto (V, VG on request) [on request]",
      "Foul (V or Ve Option) [on request]",
      "Mac & cheese (v) (vg on request) [on request]",
      "Vegetarian Miso Ramen [on request]",
      "Curry [on request]",
    ]);
    expect(r.items[2]).toEqual({ name: "Pad Thai", section: "Noodles", price: "$16", note: "on request" });
  });

  it("ignores negations, including cannot be made vegan, but not allergen disclaimers", () => {
    const r = findVeganOptions(
      menu([
        {
          name: "Mains",
          items: [
            item("Pizza", "No vegan options available."),
            item("Ramen", "Our broth is not vegan."),
            item("Mushroom risotto", "Arborio, porcini. Cannot be made vegan."),
            item("Carbonara", "Can't be made vegan"),
            item("Vegan Pad Thai", "Vegan. Allergens: we cannot guarantee any dish is free of nuts."),
          ],
        },
      ])
    );
    expect(names(r)).toEqual(["Vegan Pad Thai"]);
  });

  it("reports none for an empty or missing menu and dedupes repeated names", () => {
    expect(findVeganOptions(null).status).toBe("none");
    expect(findVeganOptions(menu([])).status).toBe("none");
    const r = findVeganOptions(menu([{ name: "Vegan", items: [item("Fries"), item("fries ")] }]));
    expect(r.items).toHaveLength(1);
  });
});
