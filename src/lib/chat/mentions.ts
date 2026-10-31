/**
 * @mentions in a group-chat message, worked out from the text alone: nothing about a mention is stored. Shared by the
 * server (who gets the "mentioned you" push) and the browser (finishing a name while it is typed, colouring a bubble),
 * so this file must stay free of `server-only` and of anything that touches the database.
 */

export interface ChatPerson {
  name: string;
  role: "student" | "teacher";
}

interface Candidate {
  /** The display name written into the message when this spelling wins. */
  name: string;
  /** The text after the "@", as the class list spells it. */
  text: string;
  /** `text` lower-cased once, for the case-insensitive comparison. */
  key: string;
}

/** What may not touch an @mention on either side: "me@gmail.com" and "@Harish" must not become mentions. */
const WORD_CHAR = /[A-Za-z0-9]/;

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}

/**
 * The spellings that may follow an "@": every full display name, plus a first word when no one else shares it. Names
 * are compared as plain strings, never turned into regexes, so punctuation in a name is harmless.
 */
function candidatesFor(people: ChatPerson[]): Candidate[] {
  const names = people.map((person) => person.name.trim()).filter(Boolean);
  const firstWordCounts = new Map<string, number>();
  for (const name of names) {
    const first = name.split(/\s+/)[0];
    const key = first.toLowerCase();
    firstWordCounts.set(key, (firstWordCounts.get(key) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const name of names) {
    const first = name.split(/\s+/)[0];
    const spellings = [name];
    // A one-word name is already its own first word; adding it twice would only duplicate the candidate.
    if (first.toLowerCase() !== name.toLowerCase() && firstWordCounts.get(first.toLowerCase()) === 1) spellings.push(first);
    for (const text of spellings) {
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ name, text, key });
    }
  }
  // The longest spelling at one "@" wins: "@Hari Vilas Panjwani" must not stop at "@Hari".
  return candidates.sort((a, b) => b.text.length - a.text.length);
}

interface Match {
  /** The canonical display name. */
  name: string;
  /** Length of the matched text, including the "@". */
  length: number;
}

/** The mention that starts at `at`, if any. */
function matchAt(body: string, at: number, candidates: Candidate[]): Match | null {
  if (body[at] !== "@") return null;
  // Start of the text, whitespace or punctuation before the "@"; a letter or digit means an email-like word.
  if (isWordChar(at > 0 ? body[at - 1] : undefined)) return null;

  for (const candidate of candidates) {
    const end = at + 1 + candidate.text.length;
    if (end > body.length) continue;
    if (body.slice(at + 1, end).toLowerCase() !== candidate.key) continue;
    // A letter or digit straight after the name means it was only the start of a longer word ("@Harish").
    if (isWordChar(body[end])) continue;
    return { name: candidate.name, length: 1 + candidate.text.length };
  }
  return null;
}

/** The canonical display names mentioned in `body`, once each, in the order they appear. */
export function findMentions(body: string, people: ChatPerson[]): string[] {
  const candidates = candidatesFor(people);
  const found: string[] = [];
  if (candidates.length === 0) return found;

  let at = body.indexOf("@");
  while (at !== -1) {
    const match = matchAt(body, at, candidates);
    if (!match) {
      at = body.indexOf("@", at + 1);
      continue;
    }
    if (!found.includes(match.name)) found.push(match.name);
    at = body.indexOf("@", at + match.length);
  }
  return found;
}

/**
 * The same text cut into plain and mentioned pieces for rendering. Joining every `text` gives back `body` exactly,
 * whatever the class list contains.
 */
export function splitMentions(body: string, people: ChatPerson[]): Array<{ text: string; mention: boolean }> {
  const candidates = candidatesFor(people);
  const parts: Array<{ text: string; mention: boolean }> = [];
  if (candidates.length === 0) return body ? [{ text: body, mention: false }] : [];

  let start = 0;
  let at = body.indexOf("@");
  while (at !== -1) {
    const match = matchAt(body, at, candidates);
    if (!match) {
      at = body.indexOf("@", at + 1);
      continue;
    }
    if (at > start) parts.push({ text: body.slice(start, at), mention: false });
    parts.push({ text: body.slice(at, at + match.length), mention: true });
    start = at + match.length;
    at = body.indexOf("@", start);
  }
  if (start < body.length) parts.push({ text: body.slice(start), mention: false });
  return parts;
}
