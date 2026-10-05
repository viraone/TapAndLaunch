import { applyChanges, isValidPath, parseReply, type CodeFiles } from "./files";
import { filesContext } from "./prompt";
import { chunk } from "./protocol";
import { salvage } from "./partial";

/**
 * A brand-new app is built in two steps so the owner isn't kept waiting: first the AI writes a short plan and
 * src/App.jsx (a few seconds), then every section that App.jsx imports is written at the same time, one AI call each.
 * The whole build takes about as long as the plan plus the slowest section, instead of every file one after another.
 */

/** One call to the AI: the conversation so far, and (optionally) a callback for the answer as it streams. */
export type Ask = (turns: Array<{ role: "user" | "assistant"; content: string }>, onText?: (piece: string) => void, signal?: AbortSignal, maxTokens?: number) => Promise<string>;

/** Thrown by `ask` when the provider says to slow down; the section is tried again after a short pause. */
export class SlowDown extends Error {}

const STARTER_MARK = "Your app starts here.";
/**
 * The most a section may write (in tokens, about 2,700 characters). The slowest section sets the build time, and the
 * AI doesn't keep to a line count it's asked for, so this is enforced: a section that reaches it is ended cleanly after
 * its last whole element (see `salvage`).
 */
export const PART_MAX_TOKENS = 850;

/** Sections written at once. More than this is a sign the plan went wrong. */
const MAX_PARTS = 10;
/** A section can import a helper that doesn't exist yet; that gets written in a second round, at most. */
const MAX_ROUNDS = 2;

/**
 * Sections are written without seeing each other, so they can't pass props. This small file (written by us, not the AI,
 * so it costs no time) lets two sections share a value by name, like the service picked in one and booked in another.
 */
export const SHARED_PATH = "src/lib/shared.js";
export const SHARED_FILE = `import { useCallback, useSyncExternalStore } from 'react';

// State that several sections share by name: const [service, setService] = useShared('service', null);
const values = new Map();
const listeners = new Set();
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useShared(key, initial) {
  if (!values.has(key)) values.set(key, initial);
  const value = useSyncExternalStore(subscribe, () => values.get(key));
  const set = useCallback(
    (next) => {
      values.set(key, typeof next === 'function' ? next(values.get(key)) : next);
      listeners.forEach((listener) => listener());
    },
    [key]
  );
  return [value, set];
}
`;

/**
 * Ready-made building blocks every new app gets (written by us, not the AI, so they cost no time), styled in the app's
 * accent color. A form field is one short line instead of a label, an input and 250 characters of classes, which makes
 * the slowest sections (forms, lists) much quicker to write, and keeps sections that are written separately matching.
 */
export const UI_PATH = "src/lib/ui.jsx";

const PALETTE = ["red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose", "slate", "gray", "zinc", "neutral", "stone"];

/** The accent color family named in the plan's design line ("accent teal-600, ..." -> "teal"). */
export function accentOf(design: string): string {
  const words = design.toLowerCase().match(/[a-z]+/g) ?? [];
  const colors = words.filter((w) => PALETTE.includes(w));
  return colors.find((c) => !["slate", "gray", "zinc", "neutral", "stone"].includes(c)) ?? colors[0] ?? "indigo";
}

export function uiKit(accent: string): string {
  const a = PALETTE.includes(accent) ? accent : "indigo";
  return `import { useState } from 'react';
import { Check, Menu, X } from 'lucide-react';

// Building blocks in this app's style. Use them for the common pieces; plain Tailwind for everything else.
export const cx = (...classes) => classes.filter(Boolean).join(' ');

// The top of every page: <SiteHeader name="Pawfect" links={[{ label: 'Services', href: '#services' }]} cta={{ label: 'Book now', href: '#book' }} />
export function SiteHeader({ name, links = [], cta }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <a href="#" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-900">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-${a}-600 text-base text-white shadow-sm">{(name || '?').charAt(0)}</span>
          {name}
        </a>
        <nav className="ml-auto hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          {links.map((l) => <a key={l.href} href={l.href} className="transition hover:text-slate-900">{l.label}</a>)}
        </nav>
        {cta && <a href={cta.href} className="ml-auto hidden rounded-full bg-${a}-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-${a}-700 md:ml-0 md:inline-flex">{cta.label}</a>}
        <button type="button" aria-label="Menu" onClick={() => setOpen(!open)} className="ml-auto grid h-11 w-11 place-items-center rounded-full text-slate-700 hover:bg-slate-100 md:hidden">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-slate-200/70 bg-white px-6 py-3 md:hidden">
          {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-medium text-slate-700 hover:bg-slate-50">{l.label}</a>)}
          {cta && <a href={cta.href} onClick={() => setOpen(false)} className="mt-1 rounded-full bg-${a}-600 px-5 py-3 text-center font-semibold text-white">{cta.label}</a>}
        </nav>
      )}
    </header>
  );
}

// The bottom of every page: <SiteFooter name="Pawfect" tagline="Gentle grooming in Portland." links={[...]} />
export function SiteFooter({ name, tagline, links = [] }) {
  return (
    <footer className="border-t border-slate-200/70 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-slate-900">{name}</p>
          {tagline && <p className="mt-1 max-w-sm text-sm text-slate-600">{tagline}</p>}
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
          {links.map((l) => <a key={l.href} href={l.href} className="hover:text-slate-900">{l.label}</a>)}
        </nav>
      </div>
      <p className="border-t border-slate-200/70 py-5 text-center text-xs text-slate-500">© {new Date().getFullYear()} {name}</p>
    </footer>
  );
}

export function Section({ id, className, children }) {
  return <section id={id} className={cx('mx-auto w-full max-w-6xl px-6 py-16 sm:py-20', className)}>{children}</section>;
}

export function Heading({ eyebrow, title, subtitle, center }) {
  return (
    <div className={cx('max-w-2xl', center && 'mx-auto text-center')}>
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-widest text-${a}-600">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-slate-600">{subtitle}</p>}
    </div>
  );
}

export function Button({ href, variant = 'primary', className, children, ...props }) {
  const style = cx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition active:scale-[.98] disabled:opacity-50',
    variant === 'primary' && 'bg-${a}-600 text-white shadow-lg shadow-${a}-600/25 hover:bg-${a}-700',
    variant === 'secondary' && 'border border-slate-300 bg-white text-slate-800 hover:border-slate-400',
    variant === 'ghost' && 'text-${a}-700 hover:bg-${a}-50',
    className
  );
  return href ? <a href={href} className={style} {...props}>{children}</a> : <button className={style} {...props}>{children}</button>;
}

export function Card({ className, children, ...props }) {
  return <div className={cx('rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm', className)} {...props}>{children}</div>;
}

export function Badge({ className, children }) {
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full bg-${a}-50 px-3 py-1 text-sm font-semibold text-${a}-700 ring-1 ring-${a}-100', className)}>{children}</span>;
}

// A labelled form control: <Field label="Dog's name" name="dog" required />, as="select" with options (text, or { label, value }), or as="textarea".
export function Field({ label, as = 'input', options = [], className, ...props }) {
  const control = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-${a}-500 focus:ring-2 focus:ring-${a}-500/30';
  return (
    <label className={cx('block text-sm font-medium text-slate-700', className)}>
      {label}
      {as === 'select' ? (
        <select className={control} {...props}>{options.map((o) => typeof o === 'object' ? <option key={o.value ?? o.label} value={o.value ?? o.label}>{o.label ?? o.value}</option> : <option key={o}>{o}</option>)}</select>
      ) : as === 'textarea' ? (
        <textarea rows={3} className={control} {...props} />
      ) : (
        <input className={control} {...props} />
      )}
    </label>
  );
}

export function Success({ title, children }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
      <Check className="mx-auto h-10 w-10 text-emerald-600" />
      <h3 className="mt-3 text-xl font-bold text-slate-900">{title}</h3>
      {children && <p className="mt-1 text-slate-600">{children}</p>}
    </div>
  );
}
`;
}

/** True while the app is still the placeholder it was created with. */
export function isFreshApp(files: CodeFiles): boolean {
  const paths = Object.keys(files);
  return paths.length === 1 && paths[0] === "src/App.jsx" && (files["src/App.jsx"] ?? "").includes(STARTER_MARK);
}

/**
 * The plan: its design line, the sections line ("sections: ServicePicker (shares service), BookingDetails (shares
 * service), Hero"), and, in the older shape, one line per file ("src/components/Hero.jsx: what it shows").
 */
export function parsePlan(text: string): { design: string; parts: Record<string, string>; sections: Array<{ name: string; shares?: string }> } {
  const body = /<plan>([\s\S]*?)<\/plan>/.exec(text)?.[1] ?? "";
  const parts: Record<string, string> = {};
  const sections: Array<{ name: string; shares?: string }> = [];
  let design = "";
  for (const raw of body.split("\n")) {
    const line = raw.replace(/^\s*[-*]\s*/, "").trim();
    const m = /^(src\/[^\s:]+)\s*:\s*(.+)$/.exec(line);
    if (m) parts[m[1] as string] = (m[2] as string).trim();
    else if (/^design\s*:/i.test(line)) design = line.replace(/^design\s*:\s*/i, "");
    else if (/^sections\s*:/i.test(line)) {
      for (const item of line.replace(/^sections\s*:\s*/i, "").split(",")) {
        const s = /^\s*([A-Z][A-Za-z0-9]*)\s*(?:\(\s*(?:shares?\s*:?\s*)?([^)]*?)\s*\))?\s*$/.exec(item);
        if (s && !sections.some((x) => x.name === s[1])) sections.push(s[2] ? { name: s[1] as string, shares: s[2] } : { name: s[1] as string });
      }
    }
  }
  return { design, parts, sections };
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
sections: ServicePicker (shares service), BookingDetails (shares service), Hero, Testimonials
</plan>
- sections: 4 to 6 component names in PascalCase that say clearly what each one is. All of them start being written the moment this line is done, by writers who see only the names, so choose names that explain themselves. NO header and NO footer: those are ready-made.
- Each section is small (about 35 lines): a form has at most 4 fields, a list at most 3 items. Anything bigger is two sections: a booking form becomes ServicePicker + BookingDetails, a schedule with filters becomes ScheduleFilters + ScheduleList.
- Two sections that must share something (the chosen service, a selected day, a cart) both get "(shares <key>)" with the same key.
<reply>One friendly sentence about what you're building.</reply>
<file path="src/App.jsx">
App.jsx imports each section with a default import (import Hero from '@/components/Hero') and renders them in page order with no props, between the ready-made header and footer: import { SiteHeader, SiteFooter } from '@/lib/ui', then <SiteHeader name="..." links={[{ label: 'Book', href: '#bookingdetails' }]} cta={{ label: 'Book now', href: '#bookingdetails' }} /> at the top and <SiteFooter name="..." tagline="..." links={[...]} /> at the bottom. Each section's id is its name in lower case, so link with href="#bookingdetails". Keep it short.
</file>
Do NOT write the component files: they are being written at the same time by others.

<owner>${clean}</owner>`;
}

/** What the AI is asked for when writing one section of a new app. */
export function partMessage(input: { message: string; design: string; app?: string; path: string; plan: string | undefined; usedAs: string[]; others?: string[] }): string {
  const clean = input.message.replace(/<\/?owner>/gi, "");
  const name = componentName(input.path);
  const page = input.others?.length ? `\nThe whole page, top to bottom: the ready-made header, ${input.others.join(", ")}, the ready-made footer. You write only ${name ?? input.path}; don't repeat what the others do.` : "";
  return `A new app is being built. Several files are being written at the same time; you write ONE of them.

What the owner asked for:
<owner>${clean}</owner>

The design every file follows: ${input.design || "pick one accent color that fits and use slate neutrals"}
${input.app ? `\nsrc/App.jsx:\n${input.app}\n` : ""}
Your file: ${input.path}${page}
${input.plan ? `What it must do: ${input.plan}` : ""}
${name ? `Its outermost element has id="${name.toLowerCase()}" (the page links to it by that).` : ""}
It is imported like this, so export exactly what these lines need:
${input.usedAs.join("\n")}
${name ? `Write it as \`export default function ${name}() { ... }\` and add \`export { ${name} };\` at the end, so either kind of import works.` : ""}

Answer with ONLY <file path="${input.path}">...the complete file...</file>. No <reply>.
- About 35 lines. There is a HARD limit of about 2,500 characters: anything past it is cut off, so put the essentials first and keep text short. Speed matters: the owner is watching, and the slowest file holds up the whole app.
- Keep the content small: a form has at most 4 fields and uses the browser's \`required\` (and \`type="email"\`) instead of validation code or per-field error messages; at most 3 cards or list items; at most 3 FAQ entries; no long arrays of options. The owner can ask for more later.
- Self-contained: keep its sample data inside this file. Do NOT import other files from src/ (they are being written right now), except the two below. Import only react, the allowed libraries, '@/lib/ui' and '@/lib/shared'.
- src/lib/ui.jsx already exists and matches the design: \`import { Section, Heading, Button, Card, Badge, Field, Success } from '@/lib/ui'\`. (It also has SiteHeader and SiteFooter, which App.jsx already uses: don't add a header or footer.) Use it for the common pieces, ESPECIALLY \`<Field label="Your email" name="email" type="email" required />\` for every form control (as="select" with options={[...]}, or as="textarea"), \`<Button>\` / \`<Button href="#book" variant="secondary">\` for buttons, \`<Section id="...">\` + \`<Heading eyebrow title subtitle />\` for a section's frame, and \`<Success title="...">\` after a form is sent. Plain Tailwind for everything else.
- One exception to "don't import other files": src/lib/shared.js already exists. If your plan line says "shares: <key>", share that value with \`import { useShared } from '@/lib/shared'\` and \`const [value, setValue] = useShared('<key>', initialValue)\`; it works like useState, shared with the other section by that key. Sample data both sections need (like the list of services) must be written the same way in both.
- A complete, polished, responsive section that looks great on a phone, following the design line exactly so it matches the rest of the app.`;
}

/** "src/components/Hero.jsx" -> "Hero", or null when the file isn't a component. */
function componentName(path: string): string | null {
  const m = /^src\/components\/([A-Z][A-Za-z0-9]*)\.jsx$/.exec(path);
  return m ? (m[1] as string) : null;
}

/**
 * An App.jsx for when the plan step stopped before writing one: the planned sections in a sensible page order
 * (header and hero first, footer last).
 */
export function fallbackApp(paths: string[]): string {
  const rank = (p: string) => (/header|nav/i.test(p) ? 0 : /hero/i.test(p) ? 1 : /footer/i.test(p) ? 3 : 2);
  const parts = paths
    .filter((p) => /^src\/components\/[A-Z][A-Za-z0-9]*\.jsx$/.test(p))
    .sort((a, b) => rank(a) - rank(b))
    .map((p) => (p.split("/").pop() as string).replace(".jsx", ""));
  return `${parts.map((n) => `import ${n} from '@/components/${n}';`).join("\n")}

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
${parts.map((n) => `      <${n} />`).join("\n")}
    </div>
  );
}`;
}

export type FirstBuildResult = { reply: string; changes: Record<string, string> } | { error: string };

/**
 * Runs the build. `send` streams text to the browser in the same tag format as a normal answer: the plan step as it is
 * written, a <writing path="..."/> line as each section starts, and each section's <file> once it is done. Sections
 * start the moment their plan line arrives, so they are written while the plan step is still writing App.jsx.
 */
/** When things happened during a build, in milliseconds from its start, for tuning speed. */
export interface BuildTimeline {
  planFirstText?: number;
  planDone?: number;
  sections: Record<string, { start: number; firstText?: number; done?: number; chars?: number; cut?: boolean }>;
}

type BuildOptions = {
  files: CodeFiles;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  ask: Ask;
  send: (text: string) => void;
  /** Filled in as the build runs. */
  timeline?: BuildTimeline;
  /** The moment the request started, so the timeline counts from there. */
  startedAt?: number;
};

export async function firstBuild(opts: BuildOptions): Promise<FirstBuildResult> {
  const timers: Array<ReturnType<typeof setInterval>> = [];
  try {
    return await build(opts, timers);
  } finally {
    timers.forEach(clearInterval);
  }
}

async function build(opts: BuildOptions, timers: Array<ReturnType<typeof setInterval>>): Promise<FirstBuildResult> {
  // Each section's result. These never reject (a failure is kept as `error`), so a section that fails while the plan is
  // still being written can't become an unhandled rejection.
  const launched = new Map<string, Promise<{ path: string; content: string | null; error?: unknown }>>();
  let planText = "";
  // The shared-state file goes first, so it's in place (and in the preview) before any section needs it.
  const seeded: CodeFiles = { ...opts.files, [SHARED_PATH]: SHARED_FILE };
  opts.send(`<file path="${SHARED_PATH}">\n${SHARED_FILE}\n</file>\n`);
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

  // Each section's text as it is written, sent 10 times a second so the preview can show it being built.
  const buffers = new Map<string, { text: string; reset: boolean }>();
  const flushPieces = () => {
    // Pieces can go out right away, even mid-plan: the browser takes them out of the stream before reading the rest.
    for (const [path, b] of buffers) if (b.text || b.reset) opts.send(chunk(path, b.text, b.reset));
    buffers.clear();
  };
  timers.push(setInterval(flushPieces, 100));
  const started = opts.startedAt ?? Date.now();
  const at = () => Date.now() - started;
  const timeline = opts.timeline;
  const piece = (path: string, text: string, reset: boolean) => {
    const t = timeline?.sections[path];
    if (t && t.firstText === undefined) t.firstText = at();
    const b = buffers.get(path) ?? { text: "", reset: false };
    if (reset) {
      b.text = "";
      b.reset = true;
    }
    b.text += text;
    buffers.set(path, b);
  };

  // The building blocks go out just before the first section starts, in the accent the plan chose.
  const built: { kit: string | null } = { kit: null };
  let others: string[] = [];
  const launch = (path: string, usedAs: string[], plan: string | undefined, app?: string) => {
    if (launched.has(path) || launched.size >= MAX_PARTS) return;
    if (built.kit === null) {
      built.kit = uiKit(accentOf(design));
      seeded[UI_PATH] = built.kit;
      emit(`\n<file path="${UI_PATH}">\n${built.kit}\n</file>`);
    }
    if (timeline) timeline.sections[path] = { start: at() };
    emit(`\n<writing path="${path}" />`);
    launched.set(
      path,
      writePart(
        opts.ask,
        partMessage({ message: opts.message, design, app, path, plan, usedAs, others }),
        path,
        (text, reset) => piece(path, text, reset),
        () => {
          const t = timeline?.sections[path];
          if (t) t.cut = true;
        }
      ).then(
        (content) => {
          const t = timeline?.sections[path];
          if (t) {
            t.done = at();
            t.chars = content?.length ?? 0;
          }
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
    // The sections line starts every section at once.
    if (plan.sections.length > 0) {
      others = plan.sections.map((x) => x.name);
      for (const x of plan.sections.slice(0, MAX_PARTS)) launch(`src/components/${x.name}.jsx`, [`import ${x.name} from '@/components/${x.name}'`], x.shares ? `shares: ${x.shares}` : undefined);
    }
    if (Object.keys(plan.parts).length > 0 && others.length === 0) others = Object.keys(plan.parts).map((p) => componentName(p)).filter((n): n is string => n !== null);
    for (const [path, what] of Object.entries(plan.parts)) {
      const name = componentName(path);
      if (name && (design || closed)) launch(path, [`import ${name} from '@/components/${name}'`], what);
    }
  };

  // The plan step is stopped as soon as App.jsx is written, or the moment it starts writing a section itself (some
  // models do, one after another, which took a real build to 34 seconds): the sections are being written in parallel.
  const stop = new AbortController();
  let cutAt = -1;
  const check = () => {
    const end = planText.indexOf("</plan>");
    if (end === -1 || stop.signal.aborted) return;
    if (/<file\s+path="src\/App\.jsx"\s*>[\s\S]*?<\/file>/.test(planText.slice(end))) return stop.abort();
    const other = /<file\s+path="(?!src\/App\.jsx")[^"]*"/.exec(planText.slice(end));
    if (other) {
      cutAt = end + other.index;
      opts.send("\n</file>\n"); // close what the browser was shown, so the rest of the answer reads cleanly
      stop.abort();
    }
  };
  try {
    planText = await opts.ask(
      [...opts.history, { role: "user", content: planMessage(opts.files, opts.message) }],
      (piece) => {
        if (stop.signal.aborted) return;
        if (timeline && timeline.planFirstText === undefined) timeline.planFirstText = at();
        planText += piece;
        opts.send(piece);
        watchPlan();
        check();
        flush();
      },
      stop.signal
    );
  } catch (error) {
    if (!stop.signal.aborted) throw error;
  } finally {
    planDone = true;
    if (timeline) timeline.planDone = at();
    flush();
  }
  if (cutAt !== -1) planText = planText.slice(0, cutAt);
  watchPlan();

  const first = parseReply(planText);
  if (first.incomplete.length) return { error: `The AI's answer was cut off while writing ${first.incomplete[0]}. Nothing was changed. Try again.` };
  const changes: Record<string, string> = { [SHARED_PATH]: SHARED_FILE, ...(built.kit === null ? {} : { [UI_PATH]: built.kit }) };
  if (built.kit === null && /@\/lib\/ui/.test(first.changes["src/App.jsx"] ?? "")) {
    built.kit = uiKit(accentOf(design));
    seeded[UI_PATH] = built.kit;
    emit(`\n<file path="${UI_PATH}">\n${built.kit}\n</file>`);
  }
  // Sections being written in parallel win over any the plan step wrote itself.
  for (const [path, content] of Object.entries(first.changes)) if (typeof content === "string" && !launched.has(path)) changes[path] = content;
  if (!changes["src/App.jsx"] && launched.size > 0) {
    changes["src/App.jsx"] = fallbackApp([...launched.keys()]);
    emit(`\n<file path="src/App.jsx">\n${changes["src/App.jsx"]}\n</file>`);
  }
  // Only a question back (no plan, no files): nothing changes, not even the shared-state file.
  if (Object.keys(first.changes).length === 0 && launched.size === 0) return { reply: first.reply, changes: {} };

  let files = applyChanges(seeded, changes);
  const { parts } = parsePlan(planText);
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Anything App.jsx (or a finished section) imports that nobody is writing yet.
    for (const m of missingImports(files)) if (!launched.has(m.path)) launch(m.path, m.usedAs, parts[m.path], files["src/App.jsx"]);
    // Building blocks made only now (no section started during the plan) are saved with the app too.
    if (built.kit !== null) {
      changes[UI_PATH] = built.kit;
      files = { ...files, [UI_PATH]: built.kit };
    }
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

async function writePart(ask: Ask, content: string, path: string, onText: (piece: string, reset: boolean) => void, onCut: () => void): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let first = true;
      const parsed = parseReply(
        await ask(
          [{ role: "user", content }],
          (piece) => {
            onText(piece, first && attempt > 0);
            first = false;
          },
          undefined,
          PART_MAX_TOKENS
        )
      );
      const exact = parsed.changes[path];
      if (typeof exact === "string" && exact.trim()) return exact;
      // A model that names the file slightly differently still wrote the right thing.
      const only = Object.values(parsed.changes).filter((c): c is string => typeof c === "string");
      if (only.length === 1 && (only[0] as string).trim()) return only[0] as string;
      // It reached its length limit: keep what it wrote, ended after its last whole element.
      const unfinished = parsed.partial[path] ?? Object.values(parsed.partial)[0];
      const kept = unfinished === undefined ? null : salvage(path, unfinished);
      if (kept) {
        onCut();
        return kept;
      }
    } catch (error) {
      if (!(error instanceof SlowDown) || attempt === 1) throw error;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return null;
}
