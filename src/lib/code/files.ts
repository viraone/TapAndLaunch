/**
 * The files of an AI-written app: `{ "src/App.jsx": "...code..." }`. Everything the model writes goes through here
 * before it is saved, and the same checks run again before it is shown, so what is stored is always well-formed.
 */
export type CodeFiles = Record<string, string>;

export const MAX_FILES = 40;
export const MAX_FILE_BYTES = 60_000;
export const MAX_TOTAL_BYTES = 400_000;

/** Files live under src/. `@/x` in code means `src/x`. jsx/js for code, css for styles. */
const PATH = /^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jsx|js|css)$/;

export function isValidPath(path: string): boolean {
  return PATH.test(path) && !path.includes("..") && path.length <= 100;
}

export function validateFiles(files: CodeFiles): string | null {
  const paths = Object.keys(files);
  if (paths.length === 0) return "The app has no files.";
  if (paths.length > MAX_FILES) return `An app can have at most ${MAX_FILES} files.`;
  let total = 0;
  for (const path of paths) {
    if (!isValidPath(path)) return `"${path}" isn't an allowed file name. Files live in src/ and end in .jsx, .js or .css.`;
    const size = new TextEncoder().encode(files[path] as string).length;
    if (size > MAX_FILE_BYTES) return `"${path}" is too large (over ${MAX_FILE_BYTES / 1000} KB). Split it into smaller files.`;
    total += size;
  }
  if (total > MAX_TOTAL_BYTES) return `The app is too large (over ${MAX_TOTAL_BYTES / 1000} KB in total).`;
  if (!files["src/App.jsx"]) return "The app needs a src/App.jsx file with the main component.";
  return null;
}

/** A change set from the model: a file's new full content, or null to delete it. */
export type CodeChanges = Record<string, string | null>;

export function applyChanges(files: CodeFiles, changes: CodeChanges): CodeFiles {
  const next: CodeFiles = { ...files };
  for (const [path, content] of Object.entries(changes)) {
    if (content === null) delete next[path];
    else next[path] = content;
  }
  return next;
}

export interface ParsedReply {
  /** What to tell the owner, in plain words. */
  reply: string;
  changes: CodeChanges;
  /** Files whose closing tag hasn't arrived yet (the reply is still streaming, or got cut off). */
  incomplete: string[];
}

/**
 * Reads the model's answer. The format is plain tags, not JSON, so code never needs escaping and a long answer can be
 * read while it is still arriving:
 *   <reply>Short message to the owner</reply>
 *   <file path="src/App.jsx">...whole file...</file>
 *   <delete path="src/old.jsx" />
 */
export function parseReply(text: string): ParsedReply {
  const changes: CodeChanges = {};
  const incomplete: string[] = [];

  const replyMatch = /<reply>([\s\S]*?)(?:<\/reply>|$)/.exec(text);
  const reply = (replyMatch?.[1] ?? "").trim();

  for (const m of text.matchAll(/<file\s+path="([^"]+)"\s*>\n?([\s\S]*?)(<\/file>|$)/g)) {
    const [, path, body, close] = m as unknown as [string, string, string, string];
    if (close === "</file>") changes[path] = stripFence(body).replace(/\n$/, "");
    else incomplete.push(path);
  }
  for (const m of text.matchAll(/<delete\s+path="([^"]+)"\s*\/?>/g)) changes[m[1] as string] = null;

  return { reply, changes, incomplete };
}

/** Models sometimes wrap code in a markdown fence inside the tag; drop it. */
function stripFence(body: string): string {
  const m = /^\s*```[a-zA-Z]*\n([\s\S]*?)\n```\s*$/.exec(body);
  return m ? (m[1] as string) : body;
}

/** A short, plain label for a version: what was asked for. */
export function summarize(prompt: string): string {
  const oneLine = prompt.replace(/\s+/g, " ").trim();
  return oneLine.length > 90 ? `${oneLine.slice(0, 87)}…` : oneLine;
}
