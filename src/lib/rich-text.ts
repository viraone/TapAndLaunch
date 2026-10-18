/**
 * The little bit of formatting a paragraph in an app can carry, stored as plain text so it stays readable in the
 * database, in the inspector's text box and to the AI:
 *
 *   **bold**   _italic_   [link text](https://…)   lines starting with "- " are a bulleted list
 *   a link can also be a phone number [206-555-0100](tel:+12065550100) or an email [write us](mailto:hi@example.com)
 *   one newline is a line break, an empty line starts a new paragraph.
 *
 * `parseRichText` turns that text into blocks the page renders (never HTML: links are checked, nothing is injected).
 * `richTextFromDom` goes the other way for the builder, where the paragraph is edited in place as real bold, italic,
 * links and bullets.
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Only http(s), tel: and mailto: addresses survive parsing. */
  href?: string;
}

export type RichBlock = { type: "p"; lines: Run[][] } | { type: "ul"; items: Run[][] };

const SAFE_HREF = /^(https?:\/\/[^\s)]+|tel:\+?[\d()./-]+|mailto:[^\s)@]+@[^\s)@]+)$/i;

/** True for a link that places a call or opens the mail app, which stays in the same tab. */
export function isContactHref(href: string): boolean {
  return /^(tel|mailto):/i.test(href);
}

/**
 * The address for what the owner typed into the link box: an email becomes mailto:, a phone number becomes tel:
 * (digits only, a US number gets +1), anything else is a web address and gets https:// when it has no scheme.
 */
export function linkHref(typed: string): string {
  const value = typed.trim();
  if (/^(https?:\/\/|tel:|mailto:)/i.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  const digits = value.replace(/[^\d+]/g, "");
  if (/^\+?\d{7,15}$/.test(digits) && /^[\d\s()+.-]+$/.test(value)) {
    return `tel:${digits.startsWith("+") ? digits : digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : digits}`;
  }
  return `https://${value}`;
}

export function parseRichText(text: string | null | undefined): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: Run[][] | null = null;
  let list: Run[][] | null = null;
  const closeParagraph = () => {
    if (paragraph?.length) blocks.push({ type: "p", lines: paragraph });
    paragraph = null;
  };
  const closeList = () => {
    if (list?.length) blocks.push({ type: "ul", items: list });
    list = null;
  };
  for (const raw of (text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*[-*•]\s+/.test(line)) {
      closeParagraph();
      (list ??= []).push(parseInline(line.replace(/^\s*[-*•]\s+/, "")));
    } else if (line.trim() === "") {
      closeParagraph();
      closeList();
    } else {
      closeList();
      (paragraph ??= []).push(parseInline(line));
    }
  }
  closeParagraph();
  closeList();
  return blocks;
}

/** `**bold**`, `_italic_` and `[text](href)` inside one line. */
export function parseInline(line: string): Run[] {
  const runs: Run[] = [];
  const pattern = /\*\*(.+?)\*\*|(?<![A-Za-z0-9])_(.+?)_(?![A-Za-z0-9])|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) runs.push({ text: line.slice(last, index) });
    if (match[1] !== undefined) runs.push(...parseInline(match[1]).map((r) => ({ ...r, bold: true })));
    else if (match[2] !== undefined) runs.push(...parseInline(match[2]).map((r) => ({ ...r, italic: true })));
    else if (match[3] !== undefined) runs.push(SAFE_HREF.test(match[4]) ? { text: match[3], href: match[4] } : { text: match[3] });
    last = index + match[0].length;
  }
  if (last < line.length) runs.push({ text: line.slice(last) });
  return runs;
}

/** True when the text carries any formatting at all; plain text can be shown as it is. */
export function hasFormatting(text: string | null | undefined): boolean {
  return /\*\*|(?<![A-Za-z0-9])_.+?_(?![A-Za-z0-9])|\]\((https?:\/\/|tel:|mailto:)|^\s*[-*•]\s+/m.test(text ?? "");
}

/**
 * The text of an edited paragraph, read back from its DOM (bold, italic, links and bullets the browser made while
 * the owner typed). Browser-only. Chrome wraps lines in <div>, Safari and Firefox use <br>; both read the same.
 */
export function richTextFromDom(root: Node): string {
  const out = blockText(root);
  return out.replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
}

function blockText(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? "";
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName;
    if (tag === "BR") out += "\n";
    else if (tag === "STRONG" || tag === "B") out += wrap(blockText(el), "**");
    else if (tag === "EM" || tag === "I") out += wrap(blockText(el), "_");
    else if (tag === "A") {
      const href = el.getAttribute("href") ?? "";
      const text = blockText(el);
      out += SAFE_HREF.test(href) ? `[${text}](${href})` : text;
    } else if (tag === "UL" || tag === "OL") {
      out += "\n";
      el.querySelectorAll(":scope > li").forEach((li) => {
        out += `- ${blockText(li).replace(/\n+/g, " ").trim()}\n`;
      });
      out += "\n";
    } else if (tag === "P") out += `\n${blockText(el)}\n\n`;
    else if (tag === "DIV") {
      const inner = blockText(el);
      // An empty <div><br></div> is how Chrome writes an empty line: a paragraph break.
      out += inner.trim() === "" ? "\n" : `\n${inner}`;
    } else out += blockText(el);
  });
  return out;
}

/** `**words**`, with any spaces at the ends kept outside the markers; nothing for empty text. */
function wrap(text: string, marker: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (!m || !m[2]) return text;
  return `${m[1]}${marker}${m[2]}${marker}${m[3]}`;
}
