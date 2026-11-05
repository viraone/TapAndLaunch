import type { Contact } from "@/lib/integrations/google/people";
import { showClient, type ShowProject } from "@/lib/openmic/push-server";

/**
 * The show's own comics as recipient candidates: the accounts in the show's Supabase project that the
 * `automation_contacts` RPC returns. Kept separate from Google's contacts so the two lists can be merged in one
 * place, using the same Contact shape, sort order and cap as src/lib/integrations/google/people.ts.
 */

const MAX_CONTACTS = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The same order listContacts uses: by name ignoring case, then by email. */
function compareContacts(left: Contact, right: Contact): number {
  const byName = left.name.toLowerCase().localeCompare(right.name.toLowerCase());
  if (byName !== 0) return byName;
  if (left.email === right.email) return 0;
  return left.email < right.email ? -1 : 1;
}

/**
 * The show's contactable accounts, read as the person holding `token` (the RPC refuses anyone else). Emails are
 * trimmed and lower-cased, malformed rows are dropped, and an address appears once. A missing name is "" because
 * Contact names are strings. On any RPC failure or unexpected shape the answer is null, and only a short code is
 * logged — never a name, an address or the token.
 */
export async function listShowContacts(
  project: ShowProject,
  token: string
): Promise<Contact[] | null> {
  let data: unknown;
  try {
    const result = await showClient(project, token).rpc("automation_contacts");
    if (result.error) {
      console.error("show contacts: rpc failed");
      return null;
    }
    data = result.data;
  } catch {
    console.error("show contacts: rpc failed");
    return null;
  }

  if (!Array.isArray(data)) {
    console.error("show contacts: unexpected response");
    return null;
  }

  const contacts: Contact[] = [];
  const seen = new Set<string>();

  for (const row of data) {
    if (contacts.length >= MAX_CONTACTS) break;
    if (!isRecord(row) || typeof row.email !== "string") continue;

    const email = row.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || seen.has(email)) continue;

    const name = typeof row.name === "string" ? row.name.trim() : "";
    seen.add(email);
    contacts.push({ name, email });
  }

  return contacts;
}

/**
 * One row per address, ignoring case and surrounding spaces. The show's row wins, except that a Gmail name fills a
 * missing show name. Show rows are kept ahead of Gmail rows when the cap is reached, the way listContacts keeps My
 * Contacts ahead of Other contacts. The result is sorted by name then email and capped at 2000.
 */
export function mergeContacts(show: Contact[], gmail: Contact[]): Contact[] {
  const merged = new Map<string, Contact>();

  for (const raw of show) {
    if (merged.size >= MAX_CONTACTS) break;
    const contact = { name: raw.name.trim(), email: raw.email.trim().toLowerCase() };
    if (!contact.email || merged.has(contact.email)) continue;
    merged.set(contact.email, contact);
  }

  for (const raw of gmail) {
    const contact = { name: raw.name.trim(), email: raw.email.trim().toLowerCase() };
    if (!contact.email) continue;

    const existing = merged.get(contact.email);
    if (existing) {
      if (!existing.name && contact.name) merged.set(contact.email, { ...existing, name: contact.name });
      continue;
    }
    if (merged.size >= MAX_CONTACTS) continue;
    merged.set(contact.email, contact);
  }

  return [...merged.values()].sort(compareContacts);
}
