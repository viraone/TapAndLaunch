import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/openmic/push-server", () => ({
  showClient: () => ({ rpc: state.rpc }),
}));

import { listSheetContacts, listShowContacts, mergeContacts } from "./show-contacts";
import type { Contact } from "@/lib/integrations/google/people";

const project = { url: "https://show.example", anonKey: "anon-key" };

beforeEach(() => {
  state.rpc.mockReset();
});

describe("listShowContacts", () => {
  it("trims and lower-cases addresses and names, and keeps one row per address", async () => {
    state.rpc.mockResolvedValue({
      data: [
        { name: "  Alex Morgan ", email: " Alex@Example.com " },
        { name: "Alex again", email: "alex@example.com" },
        { name: null, email: "sam@example.com" },
        { name: "Sam", email: "SAM@example.com" },
      ],
      error: null,
    });

    await expect(listShowContacts(project, "show-token")).resolves.toEqual([
      { name: "Alex Morgan", email: "alex@example.com" },
      { name: "", email: "sam@example.com" },
    ]);
    expect(state.rpc).toHaveBeenCalledWith("automation_contacts");
  });

  it("drops rows whose email is not a valid address", async () => {
    state.rpc.mockResolvedValue({
      data: [
        { name: "No Address", email: "not-an-email" },
        { name: "No At", email: "missing.example.com" },
        { name: "Good", email: "good@example.com" },
        { name: "Missing Email", email: null },
      ],
      error: null,
    });

    await expect(listShowContacts(project, "show-token")).resolves.toEqual([
      { name: "Good", email: "good@example.com" },
    ]);
  });

  it("returns null on an RPC error and logs no names or addresses", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpc.mockResolvedValue({
      data: null,
      error: { message: "permission denied for alex@example.com" },
    });

    await expect(listShowContacts(project, "show-token")).resolves.toBeNull();

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]?.join(" ")).not.toContain("alex@example.com");
    logged.mockRestore();
  });

  it("returns null when the RPC data is not an array", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpc.mockResolvedValue({ data: { rows: [] }, error: null });

    await expect(listShowContacts(project, "show-token")).resolves.toBeNull();
  });
});

const SHEET_URL = "https://show.example/functions/v1/contact-list";

function sheetResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("listSheetContacts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the sheet's order and cleans rows like listShowContacts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sheetResponse({
          contacts: [
            { name: "  Zoe ", email: " Zoe@Example.com " },
            { name: "Alex", email: "alex@example.com" },
            { name: "Zoe again", email: "zoe@example.com" },
            { name: "Bad", email: "not-an-email" },
            { name: null, email: "sam@example.com" },
          ],
        })
      )
    );

    await expect(listSheetContacts(SHEET_URL, project, "show-token")).resolves.toEqual([
      { name: "Zoe", email: "zoe@example.com" },
      { name: "Alex", email: "alex@example.com" },
      { name: "", email: "sam@example.com" },
    ]);
  });

  it("sends the show session and the project's anon key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sheetResponse({ contacts: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await listSheetContacts(SHEET_URL, project, "show-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SHEET_URL);
    expect(init.headers).toEqual({
      Authorization: "Bearer show-token",
      apikey: "anon-key",
    });
  });

  it("returns null on a non-200 and logs only a short code", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    logged.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sheetResponse({ error: "no" }, 403)));

    await expect(listSheetContacts(SHEET_URL, project, "show-token")).resolves.toBeNull();

    expect(logged).toHaveBeenCalledTimes(1);
    const message = logged.mock.calls[0]?.join(" ") ?? "";
    expect(message).not.toContain("show-token");
    expect(message).not.toContain("anon-key");
    logged.mockRestore();
  });

  it("returns null when fetch throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(listSheetContacts(SHEET_URL, project, "show-token")).resolves.toBeNull();

    vi.restoreAllMocks();
  });

  it("returns null when the body is not { contacts: array }", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sheetResponse({ people: [] })));
    await expect(listSheetContacts(SHEET_URL, project, "show-token")).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sheetResponse({ contacts: "nope" })));
    await expect(listSheetContacts(SHEET_URL, project, "show-token")).resolves.toBeNull();

    vi.restoreAllMocks();
  });

  it("returns an empty list when the sheet has no rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sheetResponse({ contacts: [] })));

    await expect(listSheetContacts(SHEET_URL, project, "show-token")).resolves.toEqual([]);
  });
});

describe("mergeContacts", () => {
  it("keeps one row per address, ignoring case", () => {
    const merged = mergeContacts(
      [{ name: "Alex", email: "Alex@Example.com" }],
      [{ name: "Alex from Gmail", email: "alex@example.com" }]
    );

    expect(merged).toEqual([{ name: "Alex", email: "alex@example.com" }]);
  });

  it("lets the show's name win over the Gmail name", () => {
    const merged = mergeContacts(
      [{ name: "Show Alex", email: "alex@example.com" }],
      [{ name: "Gmail Alex", email: "alex@example.com" }]
    );

    expect(merged).toEqual([{ name: "Show Alex", email: "alex@example.com" }]);
  });

  it("fills a missing show name from Gmail", () => {
    const merged = mergeContacts(
      [{ name: "  ", email: "alex@example.com" }],
      [{ name: " Gmail Alex ", email: "alex@example.com" }]
    );

    expect(merged).toEqual([{ name: "Gmail Alex", email: "alex@example.com" }]);
  });

  it("sorts by name ignoring case, then by email", () => {
    const merged = mergeContacts(
      [
        { name: "Zed", email: "zed@example.com" },
        { name: "alice", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
        { name: "Bob", email: "adam@example.com" },
      ],
      []
    );

    expect(merged.map((contact) => contact.email)).toEqual([
      "alice@example.com",
      "adam@example.com",
      "bob@example.com",
      "zed@example.com",
    ]);
  });

  it("caps the merged list at 2000, keeping the show's rows first", () => {
    const show = Array.from({ length: 2005 }, (_, index) => ({
      name: `Show ${index}`,
      email: `show${index}@example.com`,
    }));
    const gmail = [{ name: "Gmail Person", email: "gmail@example.com" }];

    const merged = mergeContacts(show, gmail);

    expect(merged).toHaveLength(2000);
    expect(merged.some((contact) => contact.email === "gmail@example.com")).toBe(false);
  });

  it("returns the other list when either side is empty", () => {
    const show = [{ name: "Show Person", email: "show@example.com" }];
    const gmail = [{ name: "Gmail Person", email: "gmail@example.com" }];

    expect(mergeContacts([], gmail)).toEqual(gmail);
    expect(mergeContacts(show, [])).toEqual(show);
  });

  it("does not change its inputs", () => {
    const show: Contact[] = [{ name: "  Show Person ", email: " Show@Example.com " }];
    const gmail: Contact[] = [{ name: " Gmail Person ", email: " GMAIL@example.com " }];
    const showBefore = structuredClone(show);
    const gmailBefore = structuredClone(gmail);

    mergeContacts(show, gmail);

    expect(show).toEqual(showBefore);
    expect(gmail).toEqual(gmailBefore);
  });
});
