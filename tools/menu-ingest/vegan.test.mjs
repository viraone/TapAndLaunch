import { describe, expect, it } from "vitest";
import { findVeganOptions } from "./vegan.mjs";

const menu = (sections) => ({ sections });
const item = (name, description = null) => ({ name, price: null, description });

describe("findVeganOptions", () => {
  it("counts every item in a section the restaurant calls vegan", () => {
    const r = findVeganOptions(menu([{ name: "Vegan", items: [item("Jackfruit tacos"), item("Cauliflower wings")] }]));
    expect(r.status).toBe("found");
    expect(r.items.map((i) => i.name)).toEqual(["Jackfruit tacos", "Cauliflower wings"]);
    expect(r.items[0].section).toBe("Vegan");
  });

  it("needs each item's own label in a mixed vegetarian & vegan section", () => {
    const r = findVeganOptions(menu([{ name: "Vegetarian & Vegan", items: [item("Veggie burger"), item("Vegan burger")] }]));
    expect(r.items.map((i) => i.name)).toEqual(["Vegan burger"]);
  });

  it("reads the common vegan tags but not the vegetarian (V) tag or unlabelled tofu", () => {
    const r = findVeganOptions(
      menu([{ name: "Mains", items: [item("Tofu Banh Mi (VG)"), item("Tofu curry (V)"), item("Mapo tofu"), item("Garden bowl", "VGN, gluten free"), item("Lentil soup", "plant-based and hearty"), item("Impossible burger")] }])
    );
    expect(r.items.map((i) => i.name)).toEqual(["Tofu Banh Mi (VG)", "Garden bowl", "Lentil soup"]);
  });

  it("marks dishes the kitchen can make vegan as on request", () => {
    const r = findVeganOptions(menu([{ name: "Noodles", items: [item("Pad Thai", "Chicken, shrimp or tofu. Can be made vegan.")] }]));
    expect(r.items).toEqual([{ name: "Pad Thai", section: "Noodles", note: "on request" }]);
  });

  it("ignores negations and disclaimers", () => {
    const r = findVeganOptions(
      menu([
        { name: "Mains", items: [item("Pizza", "No vegan options available."), item("Ramen", "Our broth is not vegan."), item("Curry", "Vegan. We cannot guarantee against cross-contact.")] },
      ])
    );
    expect(r.status).toBe("none");
  });

  it("reports none for an empty or missing menu and dedupes repeated names", () => {
    expect(findVeganOptions(null).status).toBe("none");
    expect(findVeganOptions(menu([])).status).toBe("none");
    const r = findVeganOptions(menu([{ name: "Vegan", items: [item("Fries"), item("fries ")] }]));
    expect(r.items).toHaveLength(1);
  });
});
