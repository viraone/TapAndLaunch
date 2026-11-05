import { afterEach, describe, expect, it, vi } from "vitest";
import { listContacts } from "./people";

const MY_ENDPOINT = "https://people.googleapis.com/v1/people/me/connections";
const OTHER_ENDPOINT = "https://people.googleapis.com/v1/otherContacts";

type Handler = (url: URL) => Response | Promise<Response>;

/** Answers each list from its own handler; a list with no handler answers with nobody. */
function stubFetch(handlers: { mine?: Handler; other?: Handler }) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.origin + url.pathname === OTHER_ENDPOINT) {
      return handlers.other ? handlers.other(url) : page({ otherContacts: [] });
    }
    return handlers.mine ? handlers.mine(url) : page({ connections: [] });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function page(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function failing(status: number): Response {
  return new Response("nope", { status });
}

function contact(name: string, email: string) {
  return { names: [{ displayName: name }], emailAddresses: [{ value: email }] };
}

function urlsOf(mock: ReturnType<typeof stubFetch>): URL[] {
  return mock.mock.calls.map((call) => new URL(String(call[0])));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listContacts", () => {
  it("reads both lists, names and email addresses, one page at a time", async () => {
    const fetchMock = stubFetch({
      mine: (url) => {
        if (url.searchParams.get("pageToken") === "mine-2") {
          return page({ connections: [contact("Amy", "amy@example.com")] });
        }
        return page({
          connections: [contact("Zoe", "zoe@example.com")],
          nextPageToken: "mine-2",
        });
      },
      other: (url) => {
        if (url.searchParams.get("pageToken") === "other-2") {
          return page({ otherContacts: [contact("Bob", "bob@example.com")] });
        }
        return page({
          otherContacts: [contact("Yolanda", "yolanda@example.com")],
          nextPageToken: "other-2",
        });
      },
    });

    const result = await listContacts("token_123");

    expect(result).toEqual({
      ok: true,
      contacts: [
        { name: "Amy", email: "amy@example.com" },
        { name: "Bob", email: "bob@example.com" },
        { name: "Yolanda", email: "yolanda@example.com" },
        { name: "Zoe", email: "zoe@example.com" },
      ],
    });

    const urls = urlsOf(fetchMock);
    const minePages = urls.filter((url) => url.origin + url.pathname === MY_ENDPOINT);
    const otherPages = urls.filter((url) => url.origin + url.pathname === OTHER_ENDPOINT);
    expect(minePages).toHaveLength(2);
    expect(otherPages).toHaveLength(2);

    expect(minePages[0]?.searchParams.get("personFields")).toBe("names,emailAddresses");
    expect(minePages[0]?.searchParams.get("pageSize")).toBe("1000");
    expect(minePages[0]?.searchParams.get("sortOrder")).toBe("FIRST_NAME_ASCENDING");
    expect(minePages[0]?.searchParams.get("pageToken")).toBeNull();
    expect(minePages[1]?.searchParams.get("pageToken")).toBe("mine-2");

    expect(otherPages[0]?.searchParams.get("readMask")).toBe("names,emailAddresses");
    expect(otherPages[0]?.searchParams.get("pageSize")).toBe("1000");
    // Google answers 400 to `sortOrder` on the Other contacts list (found live), so it is never sent there.
    expect(otherPages[0]?.searchParams.has("sortOrder")).toBe(false);
    expect(otherPages[0]?.searchParams.get("pageToken")).toBeNull();
    expect(otherPages[1]?.searchParams.get("pageToken")).toBe("other-2");
  });

  it("keeps the token in the Authorization header and nowhere else", async () => {
    const fetchMock = stubFetch({});

    await listContacts("secret-token-123");

    expect(fetchMock.mock.calls).toHaveLength(2);
    for (const call of fetchMock.mock.calls) {
      const url = new URL(String(call[0]));
      const init = (call as unknown as [URL, RequestInit])[1];
      expect(String(url)).not.toContain("secret-token-123");
      expect(init.body).toBeUndefined();
      expect(init.headers).toEqual({ Authorization: "Bearer secret-token-123" });
    }
  });

  it("makes one entry per email address a contact has", async () => {
    stubFetch({
      mine: () =>
        page({
          connections: [
            {
              names: [{ displayName: "Pat Example" }],
              emailAddresses: [{ value: "pat@example.com" }, { value: "PAT+SHOW@example.com" }],
            },
          ],
        }),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [
        { name: "Pat Example", email: "pat+show@example.com" },
        { name: "Pat Example", email: "pat@example.com" },
      ],
    });
  });

  it("de-duplicates an address held by more than one contact", async () => {
    stubFetch({
      mine: () =>
        page({
          connections: [
            contact("First Winner", "shared@example.com"),
            contact("Second", " SHARED@example.com "),
          ],
        }),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [{ name: "First Winner", email: "shared@example.com" }],
    });
  });

  it("keeps contacts without a name and skips malformed addresses", async () => {
    stubFetch({
      mine: () =>
        page({
          connections: [
            {
              emailAddresses: [
                { value: "nameless@example.com" },
                { value: "not-an-address" },
                { value: "two words@example.com" },
                { value: 42 },
              ],
            },
          ],
        }),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [{ name: "", email: "nameless@example.com" }],
    });
  });

  it("merges both lists and keeps the My Contacts name for a shared address", async () => {
    stubFetch({
      mine: () =>
        page({
          connections: [
            contact("Alex Mine", "alex@example.com"),
            contact("Shared From My Contacts", "shared@example.com"),
          ],
        }),
      other: () =>
        page({
          otherContacts: [
            contact("Shared From Other Contacts", " SHARED@example.com "),
            contact("Zed Other", "zed@example.com"),
          ],
        }),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [
        { name: "Alex Mine", email: "alex@example.com" },
        { name: "Shared From My Contacts", email: "shared@example.com" },
        { name: "Zed Other", email: "zed@example.com" },
      ],
    });
  });

  it("returns Other contacts when only that permission was granted", async () => {
    stubFetch({
      mine: () => failing(403),
      other: () => page({ otherContacts: [contact("Zed Other", "zed@example.com")] }),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [{ name: "Zed Other", email: "zed@example.com" }],
    });
  });

  it("returns My Contacts when only that permission was granted", async () => {
    stubFetch({
      mine: () => page({ connections: [contact("Alex Mine", "alex@example.com")] }),
      other: () => failing(403),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [{ name: "Alex Mine", email: "alex@example.com" }],
    });
  });

  it("returns the working list when the other one fails for a reason that is not permission", async () => {
    stubFetch({
      mine: () => failing(500),
      other: () => page({ otherContacts: [contact("Zed Other", "zed@example.com")] }),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [{ name: "Zed Other", email: "zed@example.com" }],
    });
  });

  it("reports no_permission only when both lists refuse with 403", async () => {
    stubFetch({
      mine: () => failing(403),
      other: () => failing(403),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: false,
      reason: "no_permission",
    });
  });

  it("reports any other failure of both lists as unavailable", async () => {
    stubFetch({
      mine: () => failing(500),
      other: () => failing(503),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("reports a 403 on one list and a failure on the other as unavailable", async () => {
    stubFetch({
      mine: () => failing(403),
      other: () => failing(500),
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("reports a network failure or a timeout on both lists as unavailable", async () => {
    stubFetch({
      mine: () => {
        throw new TypeError("fetch failed");
      },
      other: () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("stops at 2000 contacts and keeps My Contacts before Other contacts", async () => {
    const people = (offset: number) =>
      Array.from({ length: 1000 }, (_, index) =>
        contact(`Person ${offset + index}`, `person${offset + index}@example.com`)
      );

    const fetchMock = stubFetch({
      mine: (url) => {
        if (url.searchParams.get("pageToken") === "page-2") {
          return page({ connections: people(1000), nextPageToken: "page-3" });
        }
        return page({ connections: people(0), nextPageToken: "page-2" });
      },
      other: () => page({ otherContacts: [contact("Zed Other", "zed@example.com")] }),
    });

    const result = await listContacts("token_123");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contacts).toHaveLength(2000);
    expect(result.contacts.some((entry) => entry.email === "person0@example.com")).toBe(true);
    expect(result.contacts.some((entry) => entry.email === "person1999@example.com")).toBe(true);
    expect(result.contacts.some((entry) => entry.email === "zed@example.com")).toBe(false);

    const minePages = urlsOf(fetchMock).filter(
      (url) => url.origin + url.pathname === MY_ENDPOINT
    );
    expect(minePages).toHaveLength(2);
  });

  it("follows the nextPageToken of Other contacts", async () => {
    const fetchMock = stubFetch({
      other: (url) => {
        if (url.searchParams.get("pageToken") === "other-2") {
          return page({ otherContacts: [contact("Zed Other", "zed@example.com")] });
        }
        return page({
          otherContacts: [contact("Amy Other", "amy@example.com")],
          nextPageToken: "other-2",
        });
      },
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [
        { name: "Amy Other", email: "amy@example.com" },
        { name: "Zed Other", email: "zed@example.com" },
      ],
    });

    const otherPages = urlsOf(fetchMock).filter(
      (url) => url.origin + url.pathname === OTHER_ENDPOINT
    );
    expect(otherPages).toHaveLength(2);
    expect(otherPages[1]?.searchParams.get("pageToken")).toBe("other-2");
  });
});
