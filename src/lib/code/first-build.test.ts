import { describe, expect, it } from "vitest";
import { firstBuild, isFreshApp, missingImports, parsePlan, SlowDown, type Ask } from "./first-build";
import { starterFiles } from "./prompt";
import { parseReply } from "./files";

const APP = `import React from 'react';
import Header from '@/components/Header';
import Hero from './components/Hero';
import { CLASSES } from '@/data/classes';
export default function App() { return <main><Header /><Hero />{CLASSES.length}</main>; }`;

const PLAN = `<reply>Building a gym app.</reply>
<plan>
design: accent emerald, slate neutrals, rounded-3xl cards, bold headlines
src/components/Header.jsx: logo and a Join button
- src/components/Hero.jsx: big headline and a class search
</plan>
<file path="src/App.jsx">
${APP}
</file>`;

describe("new apps", () => {
  it("knows a placeholder app from a real one", () => {
    expect(isFreshApp(starterFiles("Gym"))).toBe(true);
    expect(isFreshApp({ "src/App.jsx": APP })).toBe(false);
    expect(isFreshApp({ ...starterFiles("Gym"), "src/x.js": "" })).toBe(false);
  });

  it("reads the plan", () => {
    expect(parsePlan(PLAN)).toEqual({
      design: "accent emerald, slate neutrals, rounded-3xl cards, bold headlines",
      parts: { "src/components/Header.jsx": "logo and a Join button", "src/components/Hero.jsx": "big headline and a class search" },
    });
  });

  it("finds every file that is imported but not written, with a sensible name", () => {
    const missing = missingImports({ "src/App.jsx": APP, "src/components/Header.jsx": "export default () => null" });
    expect(missing).toEqual([
      { path: "src/components/Hero.jsx", usedAs: ["import Hero from './components/Hero'"] },
      { path: "src/data/classes.js", usedAs: ["import { CLASSES } from '@/data/classes'"] },
    ]);
    expect(missingImports({ "src/App.jsx": "import React from 'react';\nimport x from './styles.css';" })).toEqual([]);
  });
});

describe("the two-step build", () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("writes the plan, then every section at the same time", async () => {
    const asked: string[] = [];
    let running = 0;
    let most = 0;
    const ask: Ask = async (turns, onText) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) {
        onText?.(PLAN);
        return PLAN;
      }
      const path = /Your file: (\S+)/.exec(last)?.[1] as string;
      asked.push(path);
      running += 1;
      most = Math.max(most, running);
      await wait(40);
      running -= 1;
      return `<file path="${path}">\nexport default function X() { return null }\nexport const CLASSES = [];\n</file>`;
    };
    const sent: string[] = [];
    const started = Date.now();
    const result = await firstBuild({ files: starterFiles("Gym"), message: "a gym app", history: [], ask, send: (t) => sent.push(t) });
    const took = Date.now() - started;

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.reply).toBe("Building a gym app.");
    expect(Object.keys(result.changes).sort()).toEqual(["src/App.jsx", "src/components/Header.jsx", "src/components/Hero.jsx", "src/data/classes.js"]);
    expect(asked.sort()).toEqual(["src/components/Header.jsx", "src/components/Hero.jsx", "src/data/classes.js"]);
    // All three were written at once: about one section's time, not three.
    expect(most).toBe(3);
    expect(took).toBeLessThan(110);
    const stream = sent.join("");
    expect(stream).toContain('<writing path="src/components/Hero.jsx" />');
    expect(stream).toContain('<file path="src/data/classes.js">');
  });

  it("writes a helper a section needed in a second round", async () => {
    const ask: Ask = async (turns) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) return `<reply>ok</reply><file path="src/App.jsx">\nimport Hero from '@/components/Hero';\nexport default () => <Hero />;\n</file>`;
      const path = /Your file: (\S+)/.exec(last)?.[1] as string;
      const body = path.endsWith("Hero.jsx") ? "import Card from '@/components/Card';\nexport default () => <Card />;" : "export default () => null;";
      return `<file path="${path}">\n${body}\n</file>`;
    };
    const result = await firstBuild({ files: starterFiles("x"), message: "x", history: [], ask, send: () => {} });
    expect("changes" in result && Object.keys(result.changes).sort()).toEqual(["src/App.jsx", "src/components/Card.jsx", "src/components/Hero.jsx"]);
  });

  it("tries a section again after a slow-down, and reports one it can't write", async () => {
    let calls = 0;
    const ask: Ask = async (turns) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) return `<file path="src/App.jsx">\nimport Hero from '@/components/Hero';\nexport default () => <Hero />;\n</file>`;
      calls += 1;
      if (calls === 1) throw new SlowDown("429");
      return "<reply>I can't.</reply>";
    };
    const result = await firstBuild({ files: starterFiles("x"), message: "x", history: [], ask, send: () => {} });
    expect(result).toEqual({ error: "The AI couldn't finish writing src/components/Hero.jsx. Nothing was changed. Try again." });
    expect(calls).toBe(2);
  }, 10_000);

  it("passes on a question without changing anything", async () => {
    const ask: Ask = async () => "<reply>Is this for one gym or several?</reply>";
    expect(await firstBuild({ files: starterFiles("x"), message: "gym", history: [], ask, send: () => {} })).toEqual({ reply: "Is this for one gym or several?", changes: {} });
  });

  it("starts each section while the plan is still being written, and keeps section output out of App.jsx", async () => {
    const events: string[] = [];
    const ask: Ask = async (turns, onText) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) {
        const text = `<plan>\ndesign: teal\nsrc/components/Header.jsx: logo\nsrc/components/Hero.jsx: headline\n</plan>\n<reply>Gym!</reply>\n<file path="src/App.jsx">\nimport Header from '@/components/Header';\nimport Hero from '@/components/Hero';\nexport default () => <><Header /><Hero /></>;\n</file>`;
        for (const piece of text.match(/[\s\S]{1,12}/g) ?? []) {
          onText?.(piece);
          await wait(2);
        }
        events.push("plan done");
        return text;
      }
      const path = /Your file: (\S+)/.exec(last)?.[1] as string;
      events.push(`start ${path}`);
      return `<file path="${path}">\nexport default function X() { return null }\n</file>`;
    };
    const sent: string[] = [];
    const result = await firstBuild({ files: starterFiles("Gym"), message: "gym", history: [], ask, send: (t) => sent.push(t) });
    expect("changes" in result && Object.keys(result.changes).sort()).toEqual(["src/App.jsx", "src/components/Header.jsx", "src/components/Hero.jsx"]);
    expect(events.indexOf("start src/components/Hero.jsx")).toBeLessThan(events.indexOf("plan done"));
    // What the browser got still reads cleanly: App.jsx is whole, and each section arrived as its own file.
    const parsed = parseReply(sent.join(""));
    expect(parsed.changes["src/App.jsx"]).toContain("export default () => <><Header /><Hero /></>;");
    expect(parsed.changes["src/App.jsx"]).not.toContain("<file");
    expect(parsed.reply).toBe("Gym!");
    expect(sent.join("")).toContain("<reply>Gym!</reply>");
    expect(Object.keys(parsed.changes).sort()).toEqual(["src/App.jsx", "src/components/Header.jsx", "src/components/Hero.jsx"]);
  });

  it("reports a provider failure in a section as that failure, without an unhandled rejection", async () => {
    const ask: Ask = async (turns, onText) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) {
        onText?.("<plan>\ndesign: x\nsrc/components/Hero.jsx: y\n");
        await wait(20);
        return "<plan>\ndesign: x\nsrc/components/Hero.jsx: y\n</plan><file path=\"src/App.jsx\">\nimport Hero from '@/components/Hero';\nexport default () => <Hero />;\n</file>";
      }
      throw new Error("key revoked");
    };
    await expect(firstBuild({ files: starterFiles("x"), message: "x", history: [], ask, send: () => {} })).rejects.toThrow("key revoked");
  });
});
