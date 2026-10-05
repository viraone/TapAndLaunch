import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { notifyAdmins, reporterHash } from "./reports";

describe("reports", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it("never stores the reporter's address, only a salted hash of it", () => {
    process.env.MEMBER_SESSION_SECRET = "secret-a";
    const a = reporterHash("203.0.113.9");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("203");
    expect(reporterHash("203.0.113.9")).toBe(a);
    expect(reporterHash("203.0.113.10")).not.toBe(a);
    process.env.MEMBER_SESSION_SECRET = "secret-b";
    expect(reporterHash("203.0.113.9")).not.toBe(a);
    expect(reporterHash(null)).toBeNull();
  });

  it("emails every platform admin about a report, with the details escaped and a link to review it", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "TapAndLaunch <hello@tapandlaunch.com>";
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "tapandlaunch.com";
    const sent: Array<{ from: string; to: string[]; subject: string; html: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        sent.push(...JSON.parse(init.body));
        return new Response("{}", { status: 200 });
      })
    );
    const admin = {
      from: () => ({ select: async () => ({ data: [{ user_id: "u1" }, { user_id: "u2" }] }) }),
      auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@example.com` } } }) } },
    };
    await notifyAdmins(admin as never, {
      appName: "Pawfect <b>Grooming</b>",
      slug: "pawfect",
      liveUrl: "https://pawfect.tapandlaunch.app",
      reason: "phishing",
      details: "Fake bank login <script>alert(1)</script>",
      contact: "sam@example.com",
      openReports: 2,
    });
    expect(sent.map((e) => e.to[0])).toEqual(["u1@example.com", "u2@example.com"]);
    const email = sent[0] as (typeof sent)[number];
    expect(email.subject).toBe("Report: Pawfect <b>Grooming</b> (It asks for passwords, bank or card details)");
    expect(email.html).toContain("Pawfect &lt;b&gt;Grooming&lt;/b&gt;");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("https://tapandlaunch.com/dashboard/admin#reports");
    expect(email.html).toContain("Open reports for this app: 2");
  });

  it("doesn't fail the report when email isn't set up", async () => {
    delete process.env.RESEND_API_KEY;
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(notifyAdmins({} as never, { appName: "A", slug: "a", liveUrl: "x", reason: "other", details: null, contact: null, openReports: 1 })).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
