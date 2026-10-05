import { describe, expect, it } from "vitest";
import { accentOf, fallbackApp, firstBuild, isFreshApp, missingImports, parsePlan, SlowDown, uiKit, type Ask } from "./first-build";
import { parse } from "@babel/parser";
import { starterFiles } from "./prompt";
import { parseReply } from "./files";
import { demux } from "./protocol";

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
      sections: [],
    });
    expect(parsePlan("<plan>\ndesign: x\nsections: ServicePicker (shares service), BookingDetails (shares: service), Hero\n</plan>").sections).toEqual([
      { name: "ServicePicker", shares: "service" },
      { name: "BookingDetails", shares: "service" },
      { name: "Hero" },
    ]);
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
    expect(Object.keys(result.changes).sort()).toEqual(["src/App.jsx", "src/components/Header.jsx", "src/components/Hero.jsx", "src/data/classes.js", "src/lib/shared.js", "src/lib/ui.jsx"]);
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
    expect("changes" in result && Object.keys(result.changes).sort()).toEqual(["src/App.jsx", "src/components/Card.jsx", "src/components/Hero.jsx", "src/lib/shared.js", "src/lib/ui.jsx"]);
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
    expect("changes" in result && Object.keys(result.changes).sort()).toEqual(["src/App.jsx", "src/components/Header.jsx", "src/components/Hero.jsx", "src/lib/shared.js", "src/lib/ui.jsx"]);
    expect(events.indexOf("start src/components/Hero.jsx")).toBeLessThan(events.indexOf("plan done"));
    // What the browser got still reads cleanly: App.jsx is whole, and each section arrived as its own file.
    const parsed = parseReply(sent.join(""));
    expect(parsed.changes["src/App.jsx"]).toContain("export default () => <><Header /><Hero /></>;");
    expect(parsed.changes["src/App.jsx"]).not.toContain("<file");
    expect(parsed.reply).toBe("Gym!");
    expect(sent.join("")).toContain("<reply>Gym!</reply>");
    expect(Object.keys(parsed.changes).sort()).toEqual(["src/App.jsx", "src/components/Header.jsx", "src/components/Hero.jsx", "src/lib/shared.js", "src/lib/ui.jsx"]);
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

  it("gives sections a shared-state file they can import without it counting as missing", async () => {
    const ask: Ask = async (turns) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) return `<plan>\ndesign: x\nsrc/components/Picker.jsx: pick a service, shares: service\nsrc/components/Details.jsx: book it, shares: service\n</plan><file path="src/App.jsx">\nimport Picker from '@/components/Picker';\nimport Details from '@/components/Details';\nexport default () => <><Picker /><Details /></>;\n</file>`;
      const path = /Your file: (\S+)/.exec(last)?.[1] as string;
      expect(last).toContain("shares: service");
      expect(last).toContain("useShared");
      return `<file path="${path}">\nimport { useShared } from '@/lib/shared';\nexport default function X() { const [s] = useShared('service', null); return s; }\n</file>`;
    };
    const result = await firstBuild({ files: starterFiles("x"), message: "x", history: [], ask, send: () => {} });
    expect("changes" in result && Object.keys(result.changes).sort()).toEqual(["src/App.jsx", "src/components/Details.jsx", "src/components/Picker.jsx", "src/lib/shared.js", "src/lib/ui.jsx"]);
    expect("changes" in result && result.changes["src/lib/shared.js"]).toContain("export function useShared");
  });

  it("streams each section's text as it is written, in pieces the browser can separate", async () => {
    const heroText = `<file path="src/components/Hero.jsx">\nexport default function Hero() {\n  return (\n    <section>\n      <h1>Fresh cuts</h1>\n    </section>\n  );\n}\n</file>`;
    const ask: Ask = async (turns, onText) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) return `<plan>\ndesign: x\nsrc/components/Hero.jsx: y\n</plan><file path="src/App.jsx">\nimport Hero from '@/components/Hero';\nexport default () => <Hero />;\n</file>`;
      for (const piece of heroText.match(/[\s\S]{1,20}/g) ?? []) {
        onText?.(piece);
        await wait(40);
      }
      return heroText;
    };
    const sent: string[] = [];
    await firstBuild({ files: starterFiles("x"), message: "x", history: [], ask, send: (t) => sent.push(t) });
    const all = sent.join("");
    expect(all).toContain('<tl-chunk path="src/components/Hero.jsx">');
    const { main, streams } = demux(all);
    expect(streams["src/components/Hero.jsx"]).toBe(heroText);
    expect(main).not.toContain("tl-chunk");
    expect(parseReply(main).changes["src/components/Hero.jsx"]).toContain("<h1>Fresh cuts</h1>");
    // Half-way through, the pieces received so far are the start of the section.
    const half = demux(all.slice(0, all.indexOf("Fresh") + 20)).streams["src/components/Hero.jsx"] ?? "";
    expect(heroText.startsWith(half)).toBe(true);
  });

  it("gives every new app building blocks in the accent the plan chose", async () => {
    expect(accentOf("accent teal-600, white and slate-50 backgrounds")).toBe("teal");
    expect(accentOf("slate neutrals, warm amber highlights")).toBe("amber");
    expect(accentOf("clean and calm")).toBe("indigo");
    const kit = uiKit("teal");
    expect(kit).toContain("bg-teal-600");
    expect(kit).toContain("export function Field(");
    expect(parse(kit, { sourceType: "module", plugins: ["jsx"] })).toBeTruthy();
    expect(uiKit("not-a-color")).toContain("bg-indigo-600");
  });

  // A plan step that keeps going and writes the sections itself, one after another (a real build took 34s this way).
  const greedy = (afterPlan: string): Ask => async (turns, onText, signal) => {
    const last = turns.at(-1)?.content ?? "";
    if (last.includes("This is a NEW app")) {
      const text = `<plan>\ndesign: teal\nsrc/components/Hero.jsx: big headline\nsrc/components/Footer.jsx: links\n</plan>\n<reply>Building it.</reply>\n${afterPlan}<file path="src/components/Hero.jsx">\nexport default function Hero() { return <h1>FROM THE PLAN STEP</h1>; }\n</file>\n<file path="src/components/Footer.jsx">\nexport default function Footer() { return <footer>plan</footer>; }\n</file>`;
      let sent = "";
      for (const piece of text.match(/[\s\S]{1,10}/g) ?? []) {
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        sent += piece;
        onText?.(piece);
        await wait(3);
      }
      return sent;
    }
    const path = /Your file: (\S+)/.exec(last)?.[1] as string;
    await wait(5);
    return `<file path="${path}">\nexport default function X() { return <p>PARALLEL ${path}</p>; }\n</file>`;
  };

  it("stops the plan step once App.jsx is written, and keeps the sections written in parallel", async () => {
    const app = `<file path="src/App.jsx">\nimport Hero from '@/components/Hero';\nimport Footer from '@/components/Footer';\nexport default () => <><Hero /><Footer /></>;\n</file>\n`;
    const sent: string[] = [];
    const result = await firstBuild({ files: starterFiles("x"), message: "x", history: [], ask: greedy(app), send: (t) => sent.push(t) });
    if (!("changes" in result)) throw new Error(JSON.stringify(result));
    expect(result.changes["src/components/Hero.jsx"]).toContain("PARALLEL");
    expect(result.changes["src/components/Footer.jsx"]).toContain("PARALLEL");
    expect(result.changes["src/App.jsx"]).toContain("<Hero />");
    expect(sent.join("")).not.toContain("FROM THE PLAN STEP");
  });

  it("stops the plan step when it starts a section before App.jsx, and makes App.jsx itself", async () => {
    const result = await firstBuild({ files: starterFiles("x"), message: "x", history: [], ask: greedy(""), send: () => {} });
    if (!("changes" in result)) throw new Error(JSON.stringify(result));
    expect(result.reply).toBe("Building it.");
    expect(result.changes["src/components/Hero.jsx"]).toContain("PARALLEL");
    expect(result.changes["src/App.jsx"]).toBe(fallbackApp(["src/components/Hero.jsx", "src/components/Footer.jsx"]));
    expect(result.changes["src/App.jsx"].indexOf("<Hero />")).toBeLessThan(result.changes["src/App.jsx"].indexOf("<Footer />"));
    expect(parse(result.changes["src/App.jsx"], { sourceType: "module", plugins: ["jsx"] })).toBeTruthy();
  });

  it("starts every section at once when the sections line arrives, telling each about the others", async () => {
    const events: string[] = [];
    const asked: Record<string, string> = {};
    const ask: Ask = async (turns, onText) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) {
        const text = `<plan>\ndesign: accent rose\nsections: ServicePicker (shares service), BookingDetails (shares service), Hero\n</plan>\n<reply>Grooming!</reply>\n<file path="src/App.jsx">\nimport Hero from '@/components/Hero';\nimport ServicePicker from '@/components/ServicePicker';\nimport BookingDetails from '@/components/BookingDetails';\nexport default () => <><Hero /><ServicePicker /><BookingDetails /></>;\n</file>`;
        for (const piece of text.match(/[\s\S]{1,8}/g) ?? []) {
          onText?.(piece);
          await wait(2);
        }
        events.push("plan done");
        return text;
      }
      const path = /Your file: (\S+)/.exec(last)?.[1] as string;
      events.push(`start ${path}`);
      asked[path] = last;
      return `<file path="${path}">\nexport default function X() { return null }\n</file>`;
    };
    const result = await firstBuild({ files: starterFiles("x"), message: "dog grooming", history: [], ask, send: () => {} });
    expect("changes" in result && Object.keys(result.changes).sort()).toEqual(["src/App.jsx", "src/components/BookingDetails.jsx", "src/components/Hero.jsx", "src/components/ServicePicker.jsx", "src/lib/shared.js", "src/lib/ui.jsx"]);
    const planDone = events.indexOf("plan done");
    for (const name of ["ServicePicker", "BookingDetails", "Hero"]) expect(events.indexOf(`start src/components/${name}.jsx`)).toBeLessThan(planDone);
    const picker = asked["src/components/ServicePicker.jsx"] as string;
    expect(picker).toContain("ServicePicker, BookingDetails, Hero");
    expect(picker).toContain("What it must do: shares: service");
    expect(picker).toContain('id="servicepicker"');
    expect(asked["src/components/Hero.jsx"]).not.toContain("What it must do: shares");
    expect("changes" in result && result.changes["src/lib/ui.jsx"]).toContain("bg-rose-600");
  });
});
