import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, BLOCK_TYPE_LABELS, defaultConfigFor } from "@/lib/builder/block-defaults";

describe("block defaults", () => {
  it("lists exactly nine distinct block types ending in listing_directory", () => {
    expect(BLOCK_TYPES).toHaveLength(9);
    expect(new Set(BLOCK_TYPES).size).toBe(BLOCK_TYPES.length);
    expect(BLOCK_TYPES[BLOCK_TYPES.length - 1]).toBe("listing_directory");
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

  it("labels listing_directory as 'Listing directory'", () => {
    expect(BLOCK_TYPE_LABELS.listing_directory).toBe("Listing directory");
  });
});
