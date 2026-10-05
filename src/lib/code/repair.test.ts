import { describe, expect, it } from "vitest";
import { parse } from "@babel/parser";
import { repairApostrophes, repairFiles } from "./repair";

const parses = (code: string) => {
  try {
    parse(code, { sourceType: "module", plugins: ["jsx"] });
    return true;
  } catch {
    return false;
  }
};

describe("repairing an apostrophe that ends a string early", () => {
  it("fixes the real slip from a build: 'We've tried many groomers'", () => {
    const broken = `const REVIEWS = [\n  { name: 'Sam', text: 'We've tried many groomers, but this is the best.' },\n  { name: 'Ana', text: 'Pepper's coat looks great and she doesn't mind the bath.' },\n];\nexport default function R() { return <p>{REVIEWS.length}</p>; }`;
    expect(parses(broken)).toBe(false);
    const fixed = repairApostrophes(broken);
    expect(parses(fixed)).toBe(true);
    expect(fixed).toContain("'We\\'ve tried");
    expect(fixed).toContain("'Pepper\\'s coat looks great and she doesn\\'t mind the bath.'");
  });

  it("leaves working code alone, including apostrophes in JSX text and double-quoted strings", () => {
    const ok = `const A = "We've got you";\nconst B = 'it\\'s fine';\nexport default function X() { return <p>Don't worry, we're open.</p>; }`;
    expect(parses(ok)).toBe(true);
    expect(repairApostrophes(ok)).toBe(ok);
  });

  it("doesn't guess at other kinds of mistakes", () => {
    const other = "export default function X() { return <div>; }";
    expect(repairApostrophes(other)).toBe(other);
  });

  it("only touches script files", () => {
    const css = "a::after { content: 'it's'; }";
    expect(repairFiles({ "src/styles.css": css })["src/styles.css"]).toBe(css);
  });
});
