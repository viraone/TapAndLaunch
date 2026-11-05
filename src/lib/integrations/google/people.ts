/**
 * The owner's Google contacts, for the Automation screen's "pick from contacts" list.
 *
 * Two lists are read: My Contacts (`people/me/connections`) and Other contacts (`otherContacts`, the people the
 * account has emailed). Every request is made as the connected Google account. Nothing here is logged: the token
 * and the contacts always stay out of console output and error text.
 */

const MY_CONTACTS_ENDPOINT = "https://people.googleapis.com/v1/people/me/connections";
const OTHER_CONTACTS_ENDPOINT = "https://people.googleapis.com/v1/otherContacts";
const PAGE_SIZE = 1000;
const MAX_PAGES = 3;
const MAX_CONTACTS = 2000;
const FETCH_TIMEOUT_MS = 10_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Contact = { name: string; email: string };

export type ListContactsResult =
  | { ok: true; contacts: Contact[] }
  | { ok: false; reason: "no_permission" | "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The person's display name, or "" when Google has none. */
function displayNameOf(entry: Record<string, unknown>): string {
  if (!Array.isArray(entry.names)) return "";
  for (const name of entry.names) {
    if (isRecord(name) && typeof name.displayName === "string") {
      return name.displayName.trim();
    }
  }
  return "";
}

/**
 * Up to three pages of one of Google's two contact lists, one entry per email address. Emails are lower-cased and
 * trimmed, malformed ones are skipped, and the same address is kept once (the first contact holding it wins). The
 * result comes back in Google's order, capped at 2000 entries.
 */
async function fetchContactList(
  accessToken: string,
  options: {
    endpoint: string;
    /** The query parameter naming the fields: `personFields` for My Contacts, `readMask` for Other contacts. */
    fieldsParam: "personFields" | "readMask";
    /** The array in Google's answer: `connections` or `otherContacts`. */
    entriesKey: "connections" | "otherContacts";
  }
): Promise<ListContactsResult> {
  const contacts: Contact[] = [];
  const seen = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(options.endpoint);
    url.searchParams.set(options.fieldsParam, "names,emailAddresses");
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    url.searchParams.set("sortOrder", "FIRST_NAME_ASCENDING");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      // A network error and a timeout both mean "try again later".
      return { ok: false, reason: "unavailable" };
    }

    if (!response.ok) {
      return { ok: false, reason: response.status === 403 ? "no_permission" : "unavailable" };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, reason: "unavailable" };
    }

    const record = isRecord(body) ? body : {};
    const entries = Array.isArray(record[options.entriesKey])
      ? (record[options.entriesKey] as unknown[])
      : [];

    for (const entry of entries) {
      if (contacts.length >= MAX_CONTACTS) break;
      if (!isRecord(entry)) continue;

      const name = displayNameOf(entry);
      const addresses = Array.isArray(entry.emailAddresses) ? entry.emailAddresses : [];

      for (const raw of addresses) {
        if (contacts.length >= MAX_CONTACTS) break;
        if (!isRecord(raw) || typeof raw.value !== "string") continue;

        const email = raw.value.trim().toLowerCase();
        if (!EMAIL_PATTERN.test(email) || seen.has(email)) continue;

        seen.add(email);
        contacts.push({ name, email });
      }
    }

    if (contacts.length >= MAX_CONTACTS) break;

    const next = record.nextPageToken;
    if (typeof next !== "string" || next.length === 0) break;
    pageToken = next;
  }

  return { ok: true, contacts };
}

/**
 * My Contacts and Other contacts together, My Contacts first. An address held by both keeps the My Contacts name.
 * The result is sorted by name then email and capped at 2000 entries, so My Contacts fill the cap before Other
 * contacts are reached.
 *
 * A missing permission on one list still returns the other one, because the owner may have granted only one. Only
 * when both lists refuse with 403 is the answer "no_permission"; any other double failure is "unavailable".
 */
export async function listContacts(accessToken: string): Promise<ListContactsResult> {
  const [myContacts, otherContacts] = await Promise.all([
    fetchContactList(accessToken, {
      endpoint: MY_CONTACTS_ENDPOINT,
      fieldsParam: "personFields",
      entriesKey: "connections",
    }),
    fetchContactList(accessToken, {
      endpoint: OTHER_CONTACTS_ENDPOINT,
      fieldsParam: "readMask",
      entriesKey: "otherContacts",
    }),
  ]);

  if (!myContacts.ok && !otherContacts.ok) {
    const noPermission =
      myContacts.reason === "no_permission" && otherContacts.reason === "no_permission";
    return { ok: false, reason: noPermission ? "no_permission" : "unavailable" };
  }

  const contacts: Contact[] = [];
  const seen = new Set<string>();

  for (const list of [myContacts, otherContacts]) {
    if (!list.ok) continue;
    for (const contact of list.contacts) {
      if (contacts.length >= MAX_CONTACTS) break;
      if (seen.has(contact.email)) continue;
      seen.add(contact.email);
      contacts.push(contact);
    }
    if (contacts.length >= MAX_CONTACTS) break;
  }

  contacts.sort((left, right) => {
    const byName = left.name.toLowerCase().localeCompare(right.name.toLowerCase());
    if (byName !== 0) return byName;
    if (left.email === right.email) return 0;
    return left.email < right.email ? -1 : 1;
  });

  return { ok: true, contacts };
}
