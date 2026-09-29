import { describe, expect, it } from "vitest";
import { listingSlug, listingsToSql } from "@/lib/listings/to-sql";

const APP = "11111111-1111-4111-8111-111111111111";

describe("listingSlug", () => {
  it("trims, lowercases, and handles missing ids", () => {
    expect(listingSlug("  Broadview-Tap-House  ")).toBe("broadview-tap-house");
    expect(listingSlug(undefined)).toBe("");
  });
});

describe("listingsToSql", () => {
  it("emits the exact single-record statement", () => {
    expect(listingsToSql([{ id: "A-1", name: "x" }], APP)).toBe(
      "begin;\ninsert into public.listings (app_id, slug, record) values\n  ('11111111-1111-4111-8111-111111111111', 'a-1', '{\"id\":\"A-1\",\"name\":\"x\"}'::jsonb)\non conflict (app_id, slug) do update set record = excluded.record;\ncommit;\n"
    );
  });

  it("joins multiple records with ,\\n and keeps the trailing statement", () => {
    const out = listingsToSql([{ id: "a" }, { id: "b" }], APP);
    expect(out).toContain("'{\"id\":\"a\"}'::jsonb),\n  ('");
    expect(out.endsWith("'{\"id\":\"b\"}'::jsonb)\non conflict (app_id, slug) do update set record = excluded.record;\ncommit;\n")).toBe(true);
  });

  it("doubles single quotes inside values", () => {
    const out = listingsToSql([{ id: "q", name: "Joe's $$ mic" }], APP);
    expect(out).toContain("'{\"id\":\"q\",\"name\":\"Joe''s $$ mic\"}'::jsonb");
  });

  it("doubles single quotes in the slug column", () => {
    const out = listingsToSql([{ id: "O'Neil" }], APP);
    expect(out).toContain(", 'o''neil', ");
  });

  it("rejects a non-uuid app id", () => {
    expect(() => listingsToSql([], "x'; drop table listings; --")).toThrow("app id must be a uuid");
  });

  it("rejects records that are not an array", () => {
    expect(() => listingsToSql({}, APP)).toThrow("records must be an array");
  });

  it("rejects an empty record list", () => {
    expect(() => listingsToSql([], APP)).toThrow("no records");
  });

  it("rejects a null record", () => {
    expect(() => listingsToSql([null], APP)).toThrow("record 0 is not an object");
  });

  it("rejects an array record", () => {
    expect(() => listingsToSql([[1]], APP)).toThrow("record 0 is not an object");
  });

  it("rejects a string record", () => {
    expect(() => listingsToSql(["a"], APP)).toThrow("record 0 is not an object");
  });

  it("rejects a record without an id", () => {
    expect(() => listingsToSql([{ name: "no id" }], APP)).toThrow("record 0 has no id");
  });

  it("rejects a blank id", () => {
    expect(() => listingsToSql([{ id: "  " }], APP)).toThrow("record 0 has no id");
  });

  it("rejects duplicate ids ignoring case and spaces", () => {
    expect(() => listingsToSql([{ id: "A" }, { id: " a " }], APP)).toThrow("duplicate id: a");
  });
});
