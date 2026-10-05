import { applyChanges, isValidPath, parseReply, type CodeFiles } from "./files";
import { filesContext } from "./prompt";

/**
 * A brand-new app is built in two steps so the owner isn't kept waiting: first the AI writes a short plan and
 * src/App.jsx (a few seconds), then every section that App.jsx imports is written at the same time, one AI call each.
 * The whole build takes about as long as the plan plus the slowest section, instead of every file one after another.
 */

/** One call to the AI: the conversation so far, and (optionally) a callback for the answer as it streams. */
export type Ask = (turns: Array<{ role: "user" | "assistant"; content: string }>, onText?: (piece: string) => void) => Promise<string>;

/** Thrown by `ask` when the provider says to slow down; the section is tried again after a short pause. */
export class SlowDown extends Error {}

const STARTER_MARK = "Your app starts here.";
/** Sections written at once. More than this is a sign the plan went wrong. */
const MAX_PARTS = 10;
/** A section can import a helper that doesn't exist yet; that gets written in a second round, at most. */
const MAX_ROUNDS = 2;

/** True while the app is still the placeholder it was created with. */
export function isFreshApp(files: CodeFiles): boolean {
  const paths = Object.keys(files);
  return paths.length === 1 && paths[0] === "src/App.jsx" && (files["src/App.jsx"] ?? "").includes(STARTER_MARK);
}

/** The plan's design line and one line per file: "src/components/Hero.jsx: what it shows". */
export function parsePlan(text: string): { design: string; parts: Record<string, string> } {
  const body = /<plan>([\s\S]*?)<\/plan>/.exec(text)?.[1] ?? "";
  const parts: Record<string, string> = {};
  let design = "";
  for (const raw of body.split("\n")) {
    const line = raw.replace(/^\s*[-*]\s*/, "").trim();
    const m = /^(src\/[^\s:]+)\s*:\s*(.+)$/.exec(line);
    if (m) parts[m[1] as string] = (m[2] as string).trim();
    else if (/^design\s*:/i.test(line)) design = line.replace(/^design\s*:\s*/i, "");
  }
  return { design, parts };
}

export interface MissingImport {
  /** Where the file should live, e.g. src/components/Hero.jsx. */
  path: string;
  /** The import lines that use it, so the writer knows exactly what to export. */
  usedAs: string[];
}

const IMPORT = /^\s*import\s+([^'"]*?)\s*from\s*["']([^"']+)["']/gm;

function resolve(from: string, spec: string): string | null {
  if (spec.startsWith("@/")) return `src/${spec.slice(2)}`;
  if (!spec.startsWith("./") && !spec.startsWith("../")) return null;
  const parts = from.split("/");
  parts.pop();
  for (const seg of spec.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

/** Every file the app imports that doesn't exist yet, with a sensible file name for each. */
export function missingImports(files: CodeFiles): MissingImport[] {
  const found = new Map<string, MissingImport>();
  for (const [from, source] of Object.entries(files)) {
    if (from.endsWith(".css")) continue;
    for (const m of source.matchAll(IMPORT)) {
      const target = resolve(from, m[2] as string);
      if (!target || target.endsWith(".css")) continue;
      const hasExt = /\.(jsx|js)$/.test(target);
      if (hasExt ? target in files : `${target}.jsx` in files || `${target}.js` in files) continue;
      // Components are .jsx; data, helpers and hooks (lower-case names) are .js.
      const base = target.split("/").pop() ?? "";
      const path = hasExt ? target : `${target}${/^[A-Z]/.test(base) ? ".jsx" : ".js"}`;
      if (!isValidPath(path)) continue;
      const entry = found.get(path) ?? { path, usedAs: [] };
      const line = (m[0] as string).trim();
      if (!entry.usedAs.includes(line)) entry.usedAs.push(line);
      found.set(path, entry);
    }
  }
  return [...found.values()];
}

/** What the AI is asked for in the first step of a new app. */
export function planMessage(files: CodeFiles, message: string): string {
  const clean = message.replace(/<\/?owner>/gi, "");
  return `The app as it is now (a placeholder, replace it):
${filesContext(files)}

This is a NEW app. To build it fast, answer with ONLY these three things, in this order:
<plan>
design: one line every section will follow: accent color (a Tailwind color name), backgrounds, headline style, corner radius, mood
src/components/Header.jsx: exactly what it shows and does (content, sample data, interactions), in one line
src/components/Hero.jsx: ...
(5 to 7 files in src/components/, one per section of the page, each small enough to write in about 50 lines; split a big section into two)
</plan>
<reply>One friendly sentence about what you're building.</reply>
<file path="src/App.jsx">
App.jsx imports every planned component with a default import (import Hero from '@/components/Hero') and renders them in order with no props. It holds only the page layout (or routing). Keep it short.
</file>
Do NOT write the component files. Each one is written by someone else at the same time, starting the moment its plan line appears, without seeing the others, so write the plan FIRST and make every line specific.

<owner>${clean}</owner>`;
}

/** What the AI is asked for when writing one section of a new app. */
export function partMessage(input: { message: string; design: string; app?: string; path: string; plan: string | undefined; usedAs: string[] }): string {
  const clean = input.message.replace(/<\/?owner>/gi, "");
  const name = componentName(input.path);
  return `A new app is being built. Several files are being written at the same time; you write ONE of them.

What the owner asked for:
<owner>${clean}</owner>

The design every file follows: ${input.design || "pick one accent color that fits and use slate neutrals"}
${input.app ? `\nsrc/App.jsx:\n${input.app}\n` : ""}
Your file: ${input.path}
${input.plan ? `What it must do: ${input.plan}` : ""}
It is imported like this, so export exactly what these lines need:
${input.usedAs.join("\n")}
${name ? `Write it as \`export default function ${name}() { ... }\` and add \`export { ${name} };\` at the end, so either kind of import works.` : ""}

Answer with ONLY <file path="${input.path}">...the complete file...</file>. No <reply>.
- About 50 lines, never more than 80. Speed matters: the owner is watching.
- Self-contained: keep its sample data inside this file. Do NOT import other files from src/ (they are being written right now). Import only react and the allowed libraries.
- A complete, polished, responsive section that looks great on a phone, following the design line exactly so it matches the rest of the app.`;
}

/** "src/components/Hero.jsx" -> "Hero", or null when the file isn't a component. */
function componentName(path: string): string | null {
  const m = /^src\/components\/([A-Z][A-Za-z0-9]*)\.jsx$/.exec(path);
  return m ? (m[1] as string) : null;
}

export type FirstBuildResult = { reply: string; changes: Record<string, string> } | { error: string };

/**
 * Runs the build. `send` streams text to the browser in the same tag format as a normal answer: the plan step as it is
 * written, a <writing path="..."/> line as each section starts, and each section's <file> once it is done. Sections
 * start the moment their plan line arrives, so they are written while the plan step is still writing App.jsx.
 */
export async function firstBuild(opts: { files: CodeFiles; message: string; history: Array<{ role: "user" | "assistant"; content: string }>; ask: Ask; send: (text: string) => void }): Promise<FirstBuildResult> {
  // Each section's result. These never reject (a failure is kept as `error`), so a section that fails while the plan is
  // still being written can't become an unhandled rejection.
  const launched = new Map<string, Promise<{ path: string; content: string | null; error?: unknown }>>();
  let planText = "";
  let design = "";
  let planDone = false;
  const queue: string[] = [];

  // Section output must never land in the middle of a file or the reply the plan step is still writing, so it waits.
  const safe = () => {
    if (planDone) return true;
    const insideFile = planText.lastIndexOf("<file ") > planText.lastIndexOf("</file>");
    const insideReply = planText.lastIndexOf("<reply>") > planText.lastIndexOf("</reply>");
    const halfTag = planText.slice(planText.lastIndexOf(">") + 1).includes("<");
    return !insideFile && !insideReply && !halfTag;
  };
  const emit = (text: string) => {
    if (safe()) opts.send(text);
    else queue.push(text);
  };
  const flush = () => {
    if (safe()) while (queue.length) opts.send(queue.shift() as string);
  };

  const launch = (path: string, usedAs: string[], plan: string | undefined, app?: string) => {
    if (launched.has(path) || launched.size >= MAX_PARTS) return;
    emit(`\n<writing path="${path}" />`);
    launched.set(
      path,
      writePart(opts.ask, partMessage({ message: opts.message, design, app, path, plan, usedAs }), path).then(
        (content) => {
          if (content !== null) emit(`\n<file path="${path}">\n${content}\n</file>`);
          return { path, content };
        },
        (error: unknown) => ({ path, content: null, error })
      )
    );
  };

  // Start each section as soon as its line of the plan has arrived.
  const watchPlan = () => {
    const body = /<plan>([\s\S]*)/.exec(planText)?.[1];
    if (body === undefined) return;
    const closed = body.includes("</plan>");
    const lines = body.split("</plan>")[0] as string;
    const complete = closed ? lines : lines.slice(0, lines.lastIndexOf("\n") + 1);
    const plan = parsePlan(`<plan>${complete}</plan>`);
    if (plan.design) design = plan.design;
    for (const [path, what] of Object.entries(plan.parts)) {
      const name = componentName(path);
      if (name && (design || closed)) launch(path, [`import ${name} from '@/components/${name}'`], what);
    }
  };

  try {
    planText = await opts.ask([...opts.history, { role: "user", content: planMessage(opts.files, opts.message) }], (piece) => {
      planText += piece;
      opts.send(piece);
      watchPlan();
      flush();
    });
  } finally {
    planDone = true;
    flush();
  }
  watchPlan();

  const first = parseReply(planText);
  if (first.incomplete.length) return { error: `The AI's answer was cut off while writing ${first.incomplete[0]}. Nothing was changed. Try again.` };
  const changes: Record<string, string> = {};
  for (const [path, content] of Object.entries(first.changes)) if (typeof content === "string") changes[path] = content;
  if (Object.keys(changes).length === 0 && launched.size === 0) return { reply: first.reply, changes: {} };

  let files = applyChanges(opts.files, first.changes);
  const { parts } = parsePlan(planText);
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Anything App.jsx (or a finished section) imports that nobody is writing yet.
    for (const m of missingImports(files)) if (!launched.has(m.path)) launch(m.path, m.usedAs, parts[m.path], files["src/App.jsx"]);
    const pending = [...launched.entries()].filter(([path]) => !(path in changes));
    if (pending.length === 0) break;
    const written = await Promise.all(pending.map(([, p]) => p));
    const broken = written.find((w) => w.error !== undefined);
    if (broken) throw broken.error;
    const failed = written.find((w) => w.content === null);
    if (failed) return { error: `The AI couldn't finish writing ${failed.path}. Nothing was changed. Try again.` };
    for (const w of written) changes[w.path] = w.content as string;
    files = { ...files, ...changes };
  }
  return { reply: first.reply, changes };
}

async function writePart(ask: Ask, content: string, path: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = parseReply(await ask([{ role: "user", content }]));
      const exact = parsed.changes[path];
      if (typeof exact === "string" && exact.trim()) return exact;
      // A model that names the file slightly differently still wrote the right thing.
      const only = Object.values(parsed.changes).filter((c): c is string => typeof c === "string");
      if (only.length === 1 && (only[0] as string).trim()) return only[0] as string;
    } catch (error) {
      if (!(error instanceof SlowDown) || attempt === 1) throw error;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return null;
}
