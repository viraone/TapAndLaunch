import { afterEach, describe, expect, it, vi } from "vitest";
import { buildStarter } from "@/lib/apps/templates";
import { collectCopy, rewriteStarterCopy } from "./rewrite";

const reply = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => (ok ? { content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }] } : { error: { message: "boom" } }) });

describe("collectCopy", () => {
  it("collects every word a visitor reads, and nothing that is an address, a path or a setting", () => {
    const starter = buildStarter("weddings", "Willow", undefined, "https://example.com/me.jpg");
    const fields = collectCopy(starter);
    const keys = fields.map((f) => f.key);
    expect(keys).toContain("0/0/headline");
    expect(keys.some((k) => k.endsWith("/quote"))).toBe(true);
    expect(keys.some((k) => k.endsWith("/answer"))).toBe(false); // Weddings has no FAQ
    for (const k of keys) expect(k, k).not.toMatch(/\/(image_url|src|url|button_page|address|phone|provider|fields|side|page|path)$/);
    for (const f of fields) {
      expect(f.text.trim().length, f.key).toBeGreaterThan(0);
      expect(f.max, f.key).toBeGreaterThan(0);
    }
    // Setting a field changes the starter in place.
    fields.find((f) => f.key === "0/0/headline")!.set("New words");
    expect((starter.pages[0].blocks[0].config as { headline?: string }).headline).toBe("New words");
  });

  it("includes the trade sections' words too", () => {
    const keys = collectCopy(buildStarter("health", "X")).map((f) => f.key);
    expect(keys.some((k) => k.endsWith("/question"))).toBe(true);
    expect(keys.some((k) => k.includes("/sections/0/items/0/name"))).toBe(true);
  });
});

describe("rewriteStarterCopy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the starter's words without a key", async () => {
    const starter = buildStarter("consulting", "X");
    const before = JSON.stringify(starter);
    const r = await rewriteStarterCopy(starter, "I help bakeries", undefined);
    expect(r.source).toBe("template");
    expect(JSON.stringify(starter)).toBe(before);
  });

  it("applies the model's words by key, caps lengths, ignores unknown keys and bad values, never touches the rest", async () => {
    const starter = buildStarter("consulting", "Harbor");
    const hero = starter.pages[0].blocks[0].config as { headline?: string; subtext?: string; button_page?: string };
    const fetchMock = reply({
      "0/0/headline": "Finance, sorted, for bakeries.",
      "0/0/subtext": { text: "A plan you'll actually follow." },
      "0/0/eyebrow": "x".repeat(400),
      "0/0/button_page": "evil",
      "9/9/headline": "nope",
      "0/2/items/0/value": 42,
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await rewriteStarterCopy(starter, "I help bakeries with their finances", "sk-ant-test");
    expect(r.source).toBe("ai");
    expect(hero.headline).toBe("Finance, sorted, for bakeries.");
    expect(hero.subtext).toBe("A plan you'll actually follow.");
    expect((hero as { eyebrow?: string }).eyebrow!.length).toBeLessThanOrEqual(40);
    expect(hero.button_page).toBe("contact");
    expect(r.changed).toBe(3);
    // The model only ever sees words: no urls, no paths, and the description is wrapped as data.
    const sent = JSON.parse((fetchMock.mock.calls[0] as [string, { body: string }])[1].body);
    const userText: string = sent.messages[0].content;
    expect(userText).toContain("<description>I help bakeries with their finances</description>");
    expect(userText).not.toMatch(/button_page|image_url|"url"|\/src"/);
    expect(sent.system).toContain("never longer than its limit");
  });

  it("strips tags and control characters from the model's words", async () => {
    const starter = buildStarter("consulting", "X");
    vi.stubGlobal("fetch", reply({ "0/0/headline": "Clear <script>alert(1)</script> advice\u0007." }));
    await rewriteStarterCopy(starter, "I help bakeries", "sk-ant-test");
    expect((starter.pages[0].blocks[0].config as { headline?: string }).headline).toBe("Clear alert(1) advice.");
  });

  it("keeps every word when the model fails, answers nonsense, or changes nothing", async () => {
    const starter = buildStarter("consulting", "X");
    const before = JSON.stringify(starter);
    vi.stubGlobal("fetch", reply("", false));
    expect((await rewriteStarterCopy(starter, "I help bakeries", "sk-ant-test")).source).toBe("template");
    vi.stubGlobal("fetch", reply("[1,2,3]"));
    expect((await rewriteStarterCopy(starter, "I help bakeries", "sk-ant-test")).source).toBe("template");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect((await rewriteStarterCopy(starter, "I help bakeries", "sk-ant-test")).note).toBe("network down");
    vi.stubGlobal("fetch", reply({}));
    expect((await rewriteStarterCopy(starter, "I help bakeries", "sk-ant-test")).source).toBe("template");
    expect(JSON.stringify(starter)).toBe(before);
  });
});
