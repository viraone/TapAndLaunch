import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/openmic/push-server", () => ({
  showClient: () => ({ rpc: state.rpc }),
}));

import { listShowContacts, mergeContacts } from "./show-contacts";
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
