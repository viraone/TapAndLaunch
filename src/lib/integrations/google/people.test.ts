import { afterEach, describe, expect, it, vi } from "vitest";
import { listContacts } from "./people";

const ENDPOINT = "https://people.googleapis.com/v1/people/me/connections";

function stubFetch(implementation: typeof fetch) {
  const mock = vi.fn(implementation);
  vi.stubGlobal("fetch", mock);
  return mock;
}

function page(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listContacts", () => {
  it("asks Google for names and email addresses, one page at a time", async () => {
    const fetchMock = stubFetch(async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get("pageToken") === "page-2") {
        return page({
          connections: [
            { names: [{ displayName: "Amy" }], emailAddresses: [{ value: "amy@example.com" }] },
          ],
        });
      }
      return page({
        connections: [
          { names: [{ displayName: "Zoe" }], emailAddresses: [{ value: "zoe@example.com" }] },
        ],
        nextPageToken: "page-2",
      });
    });

    const result = await listContacts("token_123");

    expect(result).toEqual({
      ok: true,
      contacts: [
        { name: "Amy", email: "amy@example.com" },
        { name: "Zoe", email: "zoe@example.com" },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const first = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(first.origin + first.pathname).toBe(ENDPOINT);
    expect(first.searchParams.get("personFields")).toBe("names,emailAddresses");
    expect(first.searchParams.get("pageSize")).toBe("1000");
    expect(first.searchParams.get("sortOrder")).toBe("FIRST_NAME_ASCENDING");
    expect(first.searchParams.get("pageToken")).toBeNull();

    const second = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(second.searchParams.get("pageToken")).toBe("page-2");
  });

  it("keeps the token in the Authorization header and nowhere else", async () => {
    const fetchMock = stubFetch(async () => page({ connections: [] }));

    await listContacts("secret-token-123");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).not.toContain("secret-token-123");
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({ Authorization: "Bearer secret-token-123" });
  });

  it("makes one entry per email address a contact has", async () => {
    stubFetch(async () =>
      page({
        connections: [
          {
            names: [{ displayName: "Pat Example" }],
            emailAddresses: [
              { value: "pat@example.com" },
              { value: "PAT+SHOW@example.com" },
            ],
          },
        ],
      })
    );

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [
        { name: "Pat Example", email: "pat+show@example.com" },
        { name: "Pat Example", email: "pat@example.com" },
      ],
    });
  });

  it("de-duplicates an address held by more than one contact", async () => {
    stubFetch(async () =>
      page({
        connections: [
          {
            names: [{ displayName: "First Winner" }],
            emailAddresses: [{ value: "shared@example.com" }],
          },
          {
            names: [{ displayName: "Second" }],
            emailAddresses: [{ value: " SHARED@example.com " }],
          },
        ],
      })
    );

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [{ name: "First Winner", email: "shared@example.com" }],
    });
  });

  it("keeps contacts without a name and skips malformed addresses", async () => {
    stubFetch(async () =>
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
      })
    );

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: true,
      contacts: [{ name: "", email: "nameless@example.com" }],
    });
  });

  it("reports a missing permission as its own reason", async () => {
    stubFetch(async () => new Response("forbidden", { status: 403 }));

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: false,
      reason: "no_permission",
    });
  });

  it("reports any other HTTP failure as unavailable", async () => {
    stubFetch(async () => new Response("nope", { status: 500 }));

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("reports a network failure or a timeout as unavailable", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(listContacts("token_123")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("stops at 2000 contacts and does not ask for another page", async () => {
    const people = (offset: number) =>
      Array.from({ length: 1000 }, (_, index) => ({
        names: [{ displayName: `Person ${offset + index}` }],
        emailAddresses: [{ value: `person${offset + index}@example.com` }],
      }));

    const fetchMock = stubFetch(async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get("pageToken") === "page-2") {
        return page({ connections: people(1000), nextPageToken: "page-3" });
      }
      return page({ connections: people(0), nextPageToken: "page-2" });
    });

    const result = await listContacts("token_123");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contacts).toHaveLength(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
