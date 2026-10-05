import { describe, expect, it } from "vitest";
import { applyChanges, applyEdits, isValidPath, parseReply, summarize, validateFiles } from "./files";
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

describe("small edits", () => {
  const reply = `<reply>Made it green.</reply>
<edit path="src/App.jsx">
<find>bg-sky-600</find>
<with>bg-emerald-600</with>
<find>
  <h1>Old</h1>
</find>
<with>
  <h1>New</h1>
</with>
</edit>`;

  it("reads edits, keeping the exact text between the tags", () => {
    const { edits, incomplete } = parseReply(reply);
    expect(incomplete).toEqual([]);
    expect(edits).toEqual([
      { path: "src/App.jsx", find: "bg-sky-600", replace: "bg-emerald-600" },
      { path: "src/App.jsx", find: "  <h1>Old</h1>", replace: "  <h1>New</h1>" },
    ]);
  });

  it("treats an edit that hasn't closed yet as still being written", () => {
    const { edits, incomplete } = parseReply(`<edit path="src/App.jsx"><find>a</find><with>b</with>`);
    expect(edits).toEqual([]);
    expect(incomplete).toEqual(["src/App.jsx"]);
  });

  it("applies edits in order, and leaves $ patterns in the new text alone", () => {
    const files = { "src/App.jsx": "<h1>Old</h1> <b class='bg-sky-600'/>" };
    const { files: next, failed } = applyEdits(files, [
      { path: "src/App.jsx", find: "bg-sky-600", replace: "bg-$&-600" },
      { path: "src/App.jsx", find: "<h1>Old</h1>", replace: "<h1>New</h1>" },
    ]);
    expect(failed).toEqual([]);
    expect(next["src/App.jsx"]).toBe("<h1>New</h1> <b class='bg-$&-600'/>");
    expect(files["src/App.jsx"]).toContain("Old");
  });

  it("reports edits that can't be applied cleanly instead of guessing", () => {
    const files = { "src/App.jsx": "a a b" };
    const { files: next, failed } = applyEdits(files, [
      { path: "src/App.jsx", find: "zzz", replace: "x" },
      { path: "src/App.jsx", find: "a", replace: "x" },
      { path: "src/Gone.jsx", find: "a", replace: "x" },
      { path: "src/App.jsx", find: "", replace: "x" },
    ]);
    expect(failed.map((f) => f.reason)).toEqual(["the text to find isn't in the file", "the text to find appears more than once", "that file doesn't exist", "the text to find was empty"]);
    expect(next).toEqual(files);
  });
});

describe("the preview runtime", () => {
  const page = buildCodeDocument({ "src/App.jsx": "export default () => null" }, { title: "x" });
  it("doesn't need every file to import React", () => {
    expect(page).toContain('runtime: "automatic"');
    expect(LIBS["react/jsx-runtime"]).toBeTruthy();
  });
  it("turns an icon name lucide doesn't have into a circle instead of a crash", () => {
    expect(page).toContain("lucide-react");
    expect(page).toContain(".CircleHelp || ");
  });
});
