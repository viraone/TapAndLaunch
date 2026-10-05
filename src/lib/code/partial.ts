/**
 * Turns a component file that is still being written into code that runs, so the preview can show a section while the
 * AI is typing it. The file is cut at the last point inside JSX children (between or inside elements' content), and
 * whatever is still open there is closed: the open elements, brackets, an unfinished `a ? (` gets `: null`, and so on.
 *
 * Everything before the JSX the component returns (imports, sample data, hooks) is complete by then, so the result is
 * the real section, missing only what hasn't been written yet. If there is no such point yet, the answer is null and
 * the preview keeps its placeholder. The result's default export is wrapped so an error shows the placeholder instead
 * of breaking the rest of the page.
 */

type Frame =
  | { t: "js"; close: string; ternaries: number }
  | { t: "str"; quote: string }
  | { t: "tmpl" }
  | { t: "tag"; name: string }
  | { t: "children"; name: string };

/** Characters after which `<` starts JSX rather than meaning "less than". */
const JSX_BEFORE = new Set(["", "(", ",", "=", ":", "?", "{", "[", "!", "&", "|", ">", ";", "}"]);
const JSX_BEFORE_WORDS = new Set(["return", "default", "case", "yield"]);

function closersFor(stack: Frame[]): string {
  let out = "";
  for (let i = stack.length - 1; i >= 0; i--) {
    const f = stack[i] as Frame;
    if (f.t === "children") out += `</${f.name}>`;
    else if (f.t === "js") out += " : null".repeat(f.ternaries) + f.close;
    else if (f.t === "tmpl") out += "`";
    else if (f.t === "str") out += f.quote;
    else return ""; // never cut inside an opening tag
  }
  return out;
}

const cloneStack = (stack: Frame[]): Frame[] => stack.map((f) => ({ ...f }));

/** The prefix cut at the last safe point plus the code that closes it, or null when there's no safe point yet. */
export function closePartialJsx(source: string): string | null {
  const stack: Frame[] = [{ t: "js", close: "", ternaries: 0 }];
  let last = ""; // the last significant character in JS
  let word = ""; // the word being read, and the last whole word, in JS
  let lastWord = "";
  let safe: { at: number; stack: Frame[] } | null = null;
  const n = source.length;
  let cutShort = false; // stopped early, in the middle of a closing tag or comment

  for (let i = 0; i < n; i++) {
    const top = stack[stack.length - 1] as Frame;
    const c = source[i] as string;

    if (top.t === "children") {
      safe = { at: i, stack: cloneStack(stack) };
      if (c === "{") {
        stack.push({ t: "js", close: "}", ternaries: 0 });
        last = "{";
      } else if (c === "<") {
        if (source[i + 1] === "/") {
          const end = source.indexOf(">", i);
          if (end === -1) {
            cutShort = true;
            break;
          }
          stack.pop();
          i = end;
          last = "x";
        } else {
          const m = /^<([A-Za-z0-9_.:-]*)/.exec(source.slice(i, i + 80));
          const name = m?.[1] ?? "";
          stack.push({ t: "tag", name });
          i += name.length;
        }
      }
      continue;
    }

    if (top.t === "str") {
      if (c === "\\") i++;
      else if (c === top.quote) stack.pop();
      continue;
    }

    if (top.t === "tmpl") {
      if (c === "\\") i++;
      else if (c === "`") stack.pop();
      else if (c === "$" && source[i + 1] === "{") {
        stack.push({ t: "js", close: "}", ternaries: 0 });
        i++;
        last = "{";
      }
      continue;
    }

    if (top.t === "tag") {
      if (c === '"' || c === "'") stack.push({ t: "str", quote: c });
      else if (c === "{") {
        stack.push({ t: "js", close: "}", ternaries: 0 });
        last = "{";
      } else if (c === "/" && source[i + 1] === ">") {
        stack.pop();
        i++;
        last = "x";
      } else if (c === ">") {
        stack.pop();
        stack.push({ t: "children", name: top.name });
      }
      continue;
    }

    // JavaScript.
    if (c === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      if (end === -1) {
        cutShort = true;
        break;
      }
      i = end;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) {
        cutShort = true;
        break;
      }
      i = end + 1;
      continue;
    }
    if (/[A-Za-z0-9_$]/.test(c)) {
      word += c;
      last = "x";
      continue;
    }
    if (word) {
      lastWord = word;
      word = "";
    }
    if (/\s/.test(c)) continue;

    if (c === '"' || c === "'") {
      stack.push({ t: "str", quote: c });
      last = "x";
    } else if (c === "`") {
      stack.push({ t: "tmpl" });
      last = "x";
    } else if (c === "(" || c === "[" || c === "{") {
      stack.push({ t: "js", close: c === "(" ? ")" : c === "[" ? "]" : "}", ternaries: 0 });
      last = c;
    } else if (c === ")" || c === "]" || c === "}") {
      if (top.close === c && stack.length > 1) stack.pop();
      last = c === "}" ? "}" : "x";
      if (c === "}" && stack[stack.length - 1]?.t !== "js") last = "x";
    } else if (c === "?") {
      if (source[i + 1] === "." || source[i + 1] === "?") {
        i++;
        last = "?";
      } else {
        top.ternaries += 1;
        last = "?";
      }
    } else if (c === ":") {
      if (top.ternaries > 0) top.ternaries -= 1;
      last = ":";
    } else if (c === "<" && /[A-Za-z>]/.test(source[i + 1] ?? "") && (JSX_BEFORE.has(last) || (last === "x" && JSX_BEFORE_WORDS.has(lastWord) && !word))) {
      const m = /^<([A-Za-z0-9_.:-]*)/.exec(source.slice(i, i + 80));
      const name = m?.[1] ?? "";
      stack.push({ t: "tag", name });
      i += name.length;
    } else {
      last = c;
    }
    lastWord = /[A-Za-z0-9_$]/.test(c) ? lastWord : last === "x" ? lastWord : "";
  }

  // Ended in the middle of text: keep every character written so far.
  if (!cutShort && stack[stack.length - 1]?.t === "children") safe = { at: n, stack: cloneStack(stack) };
  if (!safe) return null;
  const closers = closersFor(safe.stack);
  if (!closers) return null;
  return source.slice(0, safe.at) + closers;
}

/** The section's name from its path: src/components/RecipeList.jsx -> RecipeList. */
function nameOf(path: string): string {
  return (path.split("/").pop() ?? "Section").replace(/\.(jsx|js)$/, "");
}

/**
 * A file still being written, made runnable: closed (see above) and with its default export wrapped so an error in the
 * half-written section shows a placeholder. Null when nothing can be shown yet.
 */
export function runnablePartial(path: string, source: string): string | null {
  const body = source.replace(/^\s*```[a-zA-Z]*\n/, "");
  if (!/export\s+default|function\s+[A-Z]|const\s+[A-Z]/.test(body)) return null;
  const closed = closePartialJsx(body);
  if (!closed) return null;

  const name = nameOf(path);
  let code = closed;
  let main: string | null = null;
  const fn = /export\s+default\s+function\s*([A-Za-z0-9_$]*)\s*\(/.exec(code);
  if (fn) {
    main = fn[1] || "__TlMain";
    code = code.replace(fn[0], `function ${main}(`);
  } else {
    const named = /export\s+default\s+([A-Za-z0-9_$]+)\s*;?/.exec(code);
    if (named) {
      main = named[1] as string;
      code = code.replace(named[0], "");
    } else if (/export\s+default\s*\(/.test(code) || /export\s+default\s*[a-z_$]*\s*=>/.test(code)) {
      main = "__TlMain";
      code = code.replace(/export\s+default\s*/, "const __TlMain = ");
    } else if (new RegExp(`(function|const|let)\\s+${name}\\b`).test(code)) {
      main = name;
    }
  }
  if (!main) return null;

  const label = JSON.stringify(`Writing ${name.replace(/([a-z])([A-Z])/g, "$1 $2")}…`);
  const named = main !== "__TlMain" && !new RegExp(`export\\s*\\{[^}]*\\b${main}\\b`).test(code) ? `\nexport { ${main} };` : "";
  return `${code}${named}
import { Component as __TlComponent, createElement as __tlH } from 'react';
class __TlSafe extends __TlComponent {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? __tlH('div', { className: 'tl-stub' }, __tlH('span', null, ${label})) : this.props.children; }
}
export default function __TlPartial(props) { return __tlH(__TlSafe, null, __tlH(${main}, props)); }
`;
}
