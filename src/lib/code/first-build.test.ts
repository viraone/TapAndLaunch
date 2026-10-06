import { describe, expect, it } from "vitest";
import { accentOf, fallbackApp, firstBuild, hedge, PART_MAX_TOKENS, isFreshApp, missingImports, parsePlan, SlowDown, uiKit, type Ask, type BuildTimeline } from "./first-build";
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
      tables: "",
    });
    expect(parsePlan("<plan>\ndesign: x\ntables: tasks(title text, done boolean)\nsections: TaskList\n</plan>").tables).toBe("tasks(title text, done boolean)");
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

    if (!("changes" in result)) throw new Error(JSON.stringify(result));
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
    expect(kit).toContain("export const ACCENT = 'teal';");
    expect(kit).toContain("bg-${ACCENT}-600");
    expect(kit).toContain("export function Field(");
    expect(parse(kit, { sourceType: "module", plugins: ["jsx"] })).toBeTruthy();
    expect(uiKit("not-a-color")).toContain("export const ACCENT = 'indigo';");
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
    const app = result.changes["src/App.jsx"] as string;
    expect(app.indexOf("<Hero />")).toBeLessThan(app.indexOf("<Footer />"));
    expect(parse(app, { sourceType: "module", plugins: ["jsx"] })).toBeTruthy();
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
    expect("changes" in result && result.changes["src/lib/ui.jsx"]).toContain("export const ACCENT = 'rose';");
  });

  it("caps how much a section may write, and keeps a section that hit the cap, ended cleanly", async () => {
    const caps: Array<number | undefined> = [];
    const ask: Ask = async (turns, _onText, _signal, maxTokens) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) return `<plan>\ndesign: x\nsections: Reviews, Hero\n</plan><file path="src/App.jsx">\nimport Reviews from '@/components/Reviews';\nimport Hero from '@/components/Hero';\nexport default () => <><Hero /><Reviews /></>;\n</file>`;
      caps.push(maxTokens);
      const path = /Your file: (\S+)/.exec(last)?.[1] as string;
      // Reviews runs into its limit mid-sentence.
      if (path.endsWith("Reviews.jsx")) return `<file path="${path}">\nexport default function Reviews() {\n  return (\n    <section>\n      <h2>Reviews</h2>\n      <p>Absolutely love th`;
      return `<file path="${path}">\nexport default function Hero() { return <h1>Hi</h1>; }\n</file>`;
    };
    const timeline: BuildTimeline = { sections: {} };
    const result = await firstBuild({ files: starterFiles("x"), message: "x", history: [], ask, send: () => {}, timeline });
    if (!("changes" in result)) throw new Error(JSON.stringify(result));
    expect(caps).toEqual([PART_MAX_TOKENS, PART_MAX_TOKENS]);
    expect(result.changes["src/components/Reviews.jsx"]).toContain("<h2>Reviews</h2>");
    expect(result.changes["src/components/Reviews.jsx"]).not.toContain("Absolutely");
    expect(parse(result.changes["src/components/Reviews.jsx"] as string, { sourceType: "module", plugins: ["jsx"] })).toBeTruthy();
    expect(timeline.sections["src/components/Reviews.jsx"]?.cut).toBe(true);
    expect(timeline.sections["src/components/Hero.jsx"]?.cut).toBeUndefined();
  });

  const dataPlan = `<plan>\ndesign: x\nsections: Hero\nsrc/data/recipes.js: the recipe list\n</plan><file path="src/App.jsx">\nimport Hero from '@/components/Hero';\nimport { recipes } from '@/data/recipes';\nexport default () => <><Hero /><p>{recipes.length}</p></>;\n</file>`;

  it("keeps the whole entries of a data file that hit the cap, instead of failing the build", async () => {
    const ask: Ask = async (turns) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) return dataPlan;
      const path = /Your file: (\S+)/.exec(last)?.[1] as string;
      if (path === "src/data/recipes.js") return `<file path="${path}">\nexport const recipes = [\n  { id: 1, name: "Pad Thai" },\n  { id: 2, name: "Tacos" },\n  { id: 3, name: "Ram`;
      return `<file path="${path}">\nexport default function Hero() { return <h1>Hi</h1>; }\n</file>`;
    };
    const timeline: BuildTimeline = { sections: {} };
    const result = await firstBuild({ files: starterFiles("x"), message: "x", history: [], ask, send: () => {}, timeline });
    if (!("changes" in result)) throw new Error(JSON.stringify(result));
    const data = result.changes["src/data/recipes.js"] as string;
    expect(data).toContain("Tacos");
    expect(data).not.toContain("Ram");
    expect(parse(data, { sourceType: "module" })).toBeTruthy();
    expect(timeline.sections["src/data/recipes.js"]?.cut).toBe(true);
  });

  it("gives a section that came back empty twice the room on its second try", async () => {
    const caps: Record<string, Array<number | undefined>> = {};
    const ask: Ask = async (turns, _onText, _signal, maxTokens) => {
      const last = turns.at(-1)?.content ?? "";
      if (last.includes("This is a NEW app")) return dataPlan;
      const path = /Your file: (\S+)/.exec(last)?.[1] as string;
      (caps[path] ??= []).push(maxTokens);
      // The first try runs out of room before one whole entry is written; the second has room for all of it.
      if (path === "src/data/recipes.js") {
        return caps[path].length === 1
          ? `<file path="${path}">\nexport const recipes = [\n  { id: 1, name: "Pad Th`
          : `<file path="${path}">\nexport const recipes = [\n  { id: 1, name: "Pad Thai" },\n  { id: 2, name: "Tacos" },\n];\n</file>`;
      }
      return `<file path="${path}">\nexport default function Hero() { return <h1>Hi</h1>; }\n</file>`;
    };
    const result = await firstBuild({ files: starterFiles("x"), message: "x", history: [], ask, send: () => {} });
    if (!("changes" in result)) throw new Error(JSON.stringify(result));
    expect(caps["src/data/recipes.js"]).toEqual([PART_MAX_TOKENS, PART_MAX_TOKENS * 2]);
    expect(result.changes["src/data/recipes.js"]).toContain("Tacos");
  });
});

describe("sending a slow request again", () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // A stand-in AI: each try waits `delays[n]` before its first words, then answers; it stops if cancelled.
  function fakeAi(delays: number[], fail?: number) {
    const log: string[] = [];
    let n = 0;
    const ask: Ask = (_turns, onText, signal) => {
      const k = n++;
      log.push(`start ${k}`);
      return new Promise((resolve, reject) => {
        signal?.addEventListener("abort", () => {
          log.push(`cancelled ${k}`);
          reject(new DOMException("aborted", "AbortError"));
        });
        setTimeout(() => {
          if (signal?.aborted) return;
          if (fail === k) return reject(new Error("bad key"));
          onText?.(`answer ${k}`);
          resolve(`answer ${k}`);
        }, delays[k] ?? 0);
      });
    };
    return { ask, log };
  }

  it("uses the second try when the first is slow to start, and cancels the first", async () => {
    const { ask, log } = fakeAi([300, 10]);
    let hedges = 0;
    const pieces: string[] = [];
    const text = await hedge(ask, 40, () => hedges++)([], (p) => pieces.push(p));
    expect(text).toBe("answer 1");
    expect(pieces).toEqual(["answer 1"]);
    expect(hedges).toBe(1);
    expect(log).toEqual(["start 0", "start 1", "cancelled 0"]);
  });

  it("doesn't send a second request when the first answers in time", async () => {
    const { ask, log } = fakeAi([5]);
    expect(await hedge(ask, 40)([])).toBe("answer 0");
    await wait(60);
    expect(log).toEqual(["start 0"]);
  });

  it("fails at once on a real error instead of retrying it", async () => {
    const { ask, log } = fakeAi([5], 0);
    await expect(hedge(ask, 40)([])).rejects.toThrow("bad key");
    await wait(60);
    expect(log).toEqual(["start 0"]);
  });

  it("keeps the first try if it answers first after all", async () => {
    const { ask, log } = fakeAi([60, 200]);
    expect(await hedge(ask, 30)([])).toBe("answer 0");
    expect(log).toEqual(["start 0", "start 1", "cancelled 1"]);
  });

  it("stops both tries when the caller stops", async () => {
    const { ask, log } = fakeAi([300, 300]);
    const stop = new AbortController();
    const result = hedge(ask, 20)([], undefined, stop.signal);
    await wait(50);
    stop.abort();
    await expect(result).rejects.toThrow();
    expect(log.sort()).toEqual(["cancelled 0", "cancelled 1", "start 0", "start 1"]);
  });
});

describe("changes to an existing app", () => {
  const existing = {
    "src/App.jsx": "import { SiteHeader } from '@/lib/ui';\nimport Recipes from '@/components/Recipes';\nimport Saved from '@/components/Saved';\nexport default () => <><SiteHeader name=\"R\" /><Recipes /><Saved /></>;",
    "src/components/Recipes.jsx": "export default function Recipes() { return <p>recipes</p>; }",
    "src/components/Saved.jsx": "export default function Saved() { return <p>saved</p>; }",
    "src/lib/ui.jsx": "// THE OWNER'S OWN BUILDING BLOCKS\nexport function SiteHeader() { return null; }",
  };

  it("hands back an ordinary edit answer untouched", async () => {
    const answer = `<reply>Made it green.</reply>\n<edit path="src/components/Recipes.jsx">\n<find>recipes</find>\n<with>green recipes</with>\n</edit>`;
    const ask: Ask = async (_turns, onText) => {
      onText?.(answer);
      return answer;
    };
    const sent: string[] = [];
    const result = await firstBuild({ files: existing, message: "make it green", history: [], ask, send: (t) => sent.push(t), mode: "change", prompt: "PROMPT" });
    expect(result).toEqual({ small: answer });
    expect(sent.join("")).toBe(answer); // nothing extra (no shared-state file) for a small change
  });

  it("writes a big change's new sections in parallel, keeps the owner's building blocks, and removes sections no longer used", async () => {
    const asked: string[] = [];
    const ask: Ask = async (turns, onText) => {
      const last = turns.at(-1)?.content ?? "";
      if (last === "PROMPT") {
        const text = `<plan>\ndesign: keep the look\nsections: ServicePicker (shares service), BookingDetails (shares service)\n</plan>\n<reply>Turned it into a booking app.</reply>\n<file path="src/App.jsx">\nimport { SiteHeader } from '@/lib/ui';\nimport ServicePicker from '@/components/ServicePicker';\nimport BookingDetails from '@/components/BookingDetails';\nimport Recipes from '@/components/Recipes';\nexport default () => <><SiteHeader name="B" /><ServicePicker /><BookingDetails /><Recipes /></>;\n</file>`;
        for (const piece of text.match(/[\s\S]{1,12}/g) ?? []) onText?.(piece);
        return text;
      }
      const path = /Your file: (\S+)/.exec(last)?.[1] as string;
      asked.push(path);
      return `<file path="${path}">\nimport { useShared } from '@/lib/shared';\nexport default function X() { const [s] = useShared('service', null); return <p>{s}</p>; }\n</file>`;
    };
    const result = await firstBuild({ files: existing, message: "make it a dog grooming booking app", history: [], ask, send: () => {}, mode: "change", prompt: "PROMPT" });
    if (!("changes" in result)) throw new Error(JSON.stringify(result));
    expect(result.reply).toBe("Turned it into a booking app.");
    expect(asked.sort()).toEqual(["src/components/BookingDetails.jsx", "src/components/ServicePicker.jsx"]);
    expect(result.changes["src/components/Saved.jsx"]).toBeNull(); // no longer used
    expect("src/components/Recipes.jsx" in result.changes).toBe(false); // still used, unchanged
    expect("src/lib/ui.jsx" in result.changes).toBe(false); // the owner's own building blocks stay
    expect(result.changes["src/lib/shared.js"]).toContain("useShared"); // added: this app didn't have it
  });
});
