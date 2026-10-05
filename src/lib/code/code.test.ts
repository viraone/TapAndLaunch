import { describe, expect, it } from "vitest";
import { applyChanges, isValidPath, parseReply, summarize, validateFiles } from "./files";
import { LIBS, buildCodeDocument, embedJson } from "./document";

const ok = { "src/App.jsx": "export default function App(){return null}" };

describe("file checks", () => {
  it("accepts well-formed apps", () => {
    expect(validateFiles({ ...ok, "src/components/Hero.jsx": "x", "src/index.css": "a{}" })).toBeNull();
  });
  it("needs an App.jsx and refuses odd paths", () => {
    expect(validateFiles({ "src/Other.jsx": "x" })).toContain("src/App.jsx");
    for (const bad of ["../x.jsx", "src/../x.jsx", "App.jsx", "src/a.html", "src/a.jsx/", "/src/a.jsx", "src/a b.jsx", "src/.env", "src/a.tsx"]) expect(isValidPath(bad), bad).toBe(false);
  });
  it("refuses too many or too large files", () => {
    expect(validateFiles({ ...ok, "src/big.jsx": "x".repeat(70_000) })).toContain("too large");
    const many = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`src/f${i}.jsx`, "x"]));
    expect(validateFiles({ ...ok, ...many })).toContain("at most");
  });
});

describe("reading the model's answer", () => {
  it("reads a reply, files and deletions", () => {
    const text = `<reply>Added a pricing section.</reply>
<file path="src/App.jsx">
import React from 'react';
export default function App(){ return <div>Hi</div> }
</file>
<file path="src/components/Price.jsx">
\`\`\`jsx
export default function Price(){ return null }
\`\`\`
</file>
<delete path="src/old.jsx" />`;
    const r = parseReply(text);
    expect(r.reply).toBe("Added a pricing section.");
    expect(r.changes["src/App.jsx"]).toContain("function App");
    expect(r.changes["src/components/Price.jsx"]).toBe("export default function Price(){ return null }");
    expect(r.changes["src/old.jsx"]).toBeNull();
    expect(r.incomplete).toEqual([]);
  });
  it("tells a file that hasn't finished arriving from finished ones", () => {
    const r = parseReply(`<reply>Working</reply><file path="src/A.jsx">done</file><file path="src/B.jsx">half writ`);
    expect(Object.keys(r.changes)).toEqual(["src/A.jsx"]);
    expect(r.incomplete).toEqual(["src/B.jsx"]);
  });
  it("keeps code that contains angle brackets and quotes intact", () => {
    const code = `const x = a < b && c > d; const s = "<div class=\\"x\\">";`;
    expect(parseReply(`<file path="src/A.jsx">\n${code}\n</file>`).changes["src/A.jsx"]).toBe(code);
  });
  it("applies changes without touching the original", () => {
    const base = { "src/App.jsx": "a", "src/b.jsx": "b" };
    const next = applyChanges(base, { "src/App.jsx": "A", "src/b.jsx": null, "src/c.jsx": "c" });
    expect(next).toEqual({ "src/App.jsx": "A", "src/c.jsx": "c" });
    expect(base["src/b.jsx"]).toBe("b");
  });
  it("shortens a long prompt for the version list", () => {
    expect(summarize("a ".repeat(100)).length).toBeLessThanOrEqual(90);
    expect(summarize("  make   it\ngreen ")).toBe("make it green");
  });
});

describe("the sandbox page", () => {
  const doc = buildCodeDocument({ "src/App.jsx": 'export default () => "</script><script>alert(1)</script>"' }, { title: 'My "App" <b>', accent: "#ea580c" });
  it("cannot be broken out of by code that contains a closing script tag", () => {
    const scripts = doc.match(/<script[\s>]/g)?.length ?? 0;
    expect(doc.split("</script>").length - 1).toBe(scripts);
    expect(embedJson({ a: "</script>" })).not.toContain("</script>");
  });
  it("escapes the title and pins every library", () => {
    expect(doc).toContain("My &quot;App&quot; &lt;b&gt;");
    for (const url of Object.values(LIBS)) expect(url).toMatch(/@\d+\.\d+\.\d+/);
  });
  it("falls back to a default accent for a bad color", () => {
    expect(buildCodeDocument(ok, { title: "x", accent: "red;}</style>" })).not.toContain("red;}</style>");
  });
});
