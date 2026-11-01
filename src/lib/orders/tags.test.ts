import { describe, expect, it } from "vitest";
import { MAX_TAG_LENGTH, MAX_TAGS, normalizeTag, normalizeTags } from "./tags";

describe("normalizeTag", () => {
  it("trims the tag and collapses inner whitespace", () => {
    expect(normalizeTag("  Hello   World  ")).toBe("hello world");
  });

  it("lowercases the tag", () => {
    expect(normalizeTag("VIP")).toBe("vip");
  });

  it("removes commas", () => {
    expect(normalizeTag("a,b,c")).toBe("abc");
    expect(normalizeTag("a, b")).toBe("a b");
  });

  it("returns null when nothing is left", () => {
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag("   ")).toBeNull();
    expect(normalizeTag(" , , ")).toBeNull();
  });

  it("allows a tag of exactly the maximum length", () => {
    const tag = "x".repeat(MAX_TAG_LENGTH);
    expect(normalizeTag(`  ${tag}  `)).toBe(tag);
  });

  it("returns null when the cleaned tag is too long", () => {
    expect(normalizeTag("x".repeat(MAX_TAG_LENGTH + 1))).toBeNull();
  });

  it("measures the length after cleaning, not before", () => {
    expect(normalizeTag(` ${"x".repeat(MAX_TAG_LENGTH)} `)).toBe("x".repeat(MAX_TAG_LENGTH));
  });
});

describe("normalizeTags", () => {
  it("normalizes every tag and drops the empty ones", () => {
    expect(normalizeTags(["  VIP ", "New", "", "a,b"])).toEqual(["vip", "new", "ab"]);
  });

  it("de-duplicates tags that differ only in case or spacing", () => {
    expect(normalizeTags(["VIP", "vip", " Vip "])).toEqual(["vip"]);
  });

  it("keeps the first spelling and the original order", () => {
    expect(normalizeTags(["Second", "first", " SECOND ", "third"])).toEqual([
      "second",
      "first",
      "third",
    ]);
  });

  it("caps the list at 10 tags without reordering", () => {
    const raw = Array.from({ length: MAX_TAGS + 2 }, (_, index) => `Tag ${index}`);
    expect(normalizeTags(raw)).toEqual(
      Array.from({ length: MAX_TAGS }, (_, index) => `tag ${index}`)
    );
  });
});
