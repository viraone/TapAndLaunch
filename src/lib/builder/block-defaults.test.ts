import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, BLOCK_TYPE_LABELS, defaultConfigFor } from "@/lib/builder/block-defaults";

describe("block defaults", () => {
  it("lists exactly nineteen distinct block types, the showcase blocks last", () => {
    expect(BLOCK_TYPES).toHaveLength(19);
    expect(new Set(BLOCK_TYPES).size).toBe(BLOCK_TYPES.length);
    expect(BLOCK_TYPES.slice(-6)).toEqual(["hero", "price_list", "hours", "reviews", "stats", "gallery"]);
  });

  it("has a non-empty label and an object default config for every block type", () => {
    for (const type of BLOCK_TYPES) {
      const label = BLOCK_TYPE_LABELS[type];
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);

      const config = defaultConfigFor(type);
      expect(config).not.toBeNull();
      expect(Array.isArray(config)).toBe(false);
    }
  });

  it("defaults listing_directory to the open-mic directory settings", () => {
    expect(defaultConfigFor("listing_directory")).toEqual({
      title: "Open mics today",
      time_zone: "America/Los_Angeles",
    });
  });

  it("defaults gas_directory to a live-location search with a Capitol Hill fallback", () => {
    expect(defaultConfigFor("gas_directory")).toEqual({
      title: "Cheapest gas near me",
      radius_miles: 2,
      fallback_label: "Capitol Hill, Seattle",
      fallback_latitude: 47.6249,
      fallback_longitude: -122.3223,
      default_sort: "price",
      default_grade: "regular",
    });
  });

  it("defaults food_directory to the LiveBites copy, every cuisine, open-first", () => {
    expect(defaultConfigFor("food_directory")).toEqual({
      title: "Real-time food near me",
      subtitle: "See what is open right now within 2 miles, and how long until it closes.",
      radius_miles: 2,
      fallback_label: "Capitol Hill, Seattle",
      fallback_latitude: 47.6249,
      fallback_longitude: -122.3223,
      cuisines: [
        "ramen", "vietnamese", "thai", "korean", "taiwanese", "japanese",
        "mexican", "pizza", "burgers", "mediterranean", "ethiopian", "indian", "healthy", "bars", "ice_cream", "dessert",
      ],
      default_sort: "open",
    });
  });

  it("labels listing_directory as 'Listing directory'", () => {
    expect(BLOCK_TYPE_LABELS.listing_directory).toBe("Listing directory");
  });
});
