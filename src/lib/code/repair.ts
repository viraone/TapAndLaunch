import { parse } from "@babel/parser";
import type { CodeFiles } from "./files";

/**
 * Fixes the mistake AI models make most often in sample data: an apostrophe inside single-quoted text,
 * `'We've tried many groomers'`, which ends the string early so the whole app can't be read. (In JSX text an apostrophe
 * is fine, so only lines that fail to parse are touched.) Each fix is kept only if the file then parses further.
 */
export function repairApostrophes(source: string): string {
  let code = source;
  for (let attempt = 0; attempt < 20; attempt++) {
    const error = parseError(code);
    if (!error) return code;
    const lines = code.split("\n");
    const line = lines[error.line - 1];
    if (line === undefined) return code;
    // A letter, an unescaped apostrophe, a letter: We've, don't, Sam's.
    const fixed = line.replace(/([A-Za-z])(?<!\\)'([A-Za-z])/g, "$1\\'$2");
    if (fixed === line) return code;
    lines[error.line - 1] = fixed;
    const next = lines.join("\n");
    const after = parseError(next);
    // Keep the change only if this line is no longer where it fails.
    if (after && after.line <= error.line) return code;
    code = next;
  }
  return code;
}

function parseError(code: string): { line: number } | null {
  try {
    parse(code, { sourceType: "module", plugins: ["jsx"], errorRecovery: false });
    return null;
  } catch (e) {
    const loc = (e as { loc?: { line: number } }).loc;
    return { line: loc?.line ?? 0 };
  }
}

/** Every .js/.jsx file run through `repairApostrophes`. */
export function repairFiles(files: CodeFiles): CodeFiles {
  const out: CodeFiles = {};
  for (const [path, source] of Object.entries(files)) out[path] = /\.(jsx|js)$/.test(path) ? repairApostrophes(source) : source;
  return out;
}
