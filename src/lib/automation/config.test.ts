import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/openmic/push-server", () => ({
  showProjectFor: async () => null,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("the database must not be reached");
  },
}));

import { usableContactListUrl } from "./config";

const PROJECT_URL = "https://show.supabase.co";

describe("usableContactListUrl", () => {
  it("accepts an https function URL on the show's own project", () => {
    expect(
      usableContactListUrl(
        "https://show.supabase.co/functions/v1/contact-list",
        PROJECT_URL
      )
    ).toBe("https://show.supabase.co/functions/v1/contact-list");
  });

  it("trims spaces around a good URL", () => {
    expect(
      usableContactListUrl(
        "  https://show.supabase.co/functions/v1/contact-list  ",
        PROJECT_URL
      )
    ).toBe("https://show.supabase.co/functions/v1/contact-list");
  });

  it("rejects a value that is not a string", () => {
    expect(usableContactListUrl(undefined, PROJECT_URL)).toBeNull();
    expect(usableContactListUrl(null, PROJECT_URL)).toBeNull();
    expect(usableContactListUrl(42, PROJECT_URL)).toBeNull();
    expect(usableContactListUrl({ url: "https://show.supabase.co" }, PROJECT_URL)).toBeNull();
  });

  it("rejects plain http", () => {
    expect(
      usableContactListUrl(
        "http://show.supabase.co/functions/v1/contact-list",
        PROJECT_URL
      )
    ).toBeNull();
  });

  it("rejects another host, even with the same path", () => {
    expect(
      usableContactListUrl(
        "https://other.supabase.co/functions/v1/contact-list",
        PROJECT_URL
      )
    ).toBeNull();
    expect(
      usableContactListUrl(
        "https://show.supabase.co.example.com/functions/v1/contact-list",
        PROJECT_URL
      )
    ).toBeNull();
  });

  it("rejects a path that is not a function", () => {
    expect(
      usableContactListUrl("https://show.supabase.co/rest/v1/contacts", PROJECT_URL)
    ).toBeNull();
    expect(
      usableContactListUrl("https://show.supabase.co/functions/v1", PROJECT_URL)
    ).toBeNull();
  });

  it("rejects an empty or unreadable value", () => {
    expect(usableContactListUrl("   ", PROJECT_URL)).toBeNull();
    expect(usableContactListUrl("not a url", PROJECT_URL)).toBeNull();
  });

  it("rejects anything when the project URL is unreadable", () => {
    expect(
      usableContactListUrl(
        "https://show.supabase.co/functions/v1/contact-list",
        "not a url"
      )
    ).toBeNull();
  });
});
