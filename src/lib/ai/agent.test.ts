import { describe, expect, it, vi } from "vitest";
import { AgentReply, applyAgentOperations, runAgent } from "./agent";
import type { Draft } from "@/lib/ai/builder-ops";
import type { BlockConfig } from "@/types/database";

const draft = (): Draft => ({
  theme: { primary_color: "#112233" },
  pages: [
    {
      id: "p1",
      name: "Home",
      path: "home",
      isHome: true,
      blocks: [
        { type: "hero", config: { headline: "Hi", subtext: "Welcome", image_url: "https://x/y.jpg", button_label: "", button_page: "" } as BlockConfig, min_tier: null },
        { type: "reviews", config: { title: "Kind words", items: [{ quote: "Great", name: "Ann" }] } as BlockConfig, min_tier: null },
        { type: "listing_directory", config: { title: "Tonight" } as BlockConfig, min_tier: null },
      ],
    },
  ],
});

describe("applyAgentOperations", () => {
  it("set_words changes only text fields that exist, capped and sanitised", () => {
    const { draft: after, applied, skipped } = applyAgentOperations(draft(), [
      { op: "set_words", page: "home", index: 0, words: { headline: "Hello <b>there</b>", image_url: "https://evil", "items.0.quote": "nope" } },
      { op: "set_words", page: "home", index: 1, words: { "items.0.quote": "Really great", "items.5.quote": "no such item" } },
      { op: "set_words", page: "home", index: 2, words: { title: "Open mics tonight" } },
      { op: "set_words", page: "home", index: 9, words: { title: "x" } },
    ]);
    expect(applied).toBe(3);
    expect((after.pages[0].blocks[0].config as { headline: string; image_url: string }).headline).toBe("Hello there");
    expect((after.pages[0].blocks[0].config as { image_url: string }).image_url).toBe("https://x/y.jpg");
    expect((after.pages[0].blocks[1].config as { items: Array<{ quote: string }> }).items[0].quote).toBe("Really great");
    expect((after.pages[0].blocks[2].config as { title: string }).title).toBe("Open mics tonight");
    expect(skipped).toEqual([
      'set_words: "image_url" is not a text field of a hero section',
      'set_words: "items.0.quote" is not a text field of a hero section',
      'set_words: "items.5.quote" does not exist on this section',
      'set_words: no section 9 on "home"',
    ]);
  });

  it("links a banner button only to a page the site has, including one added earlier in the same run", () => {
    const { draft: after, skipped } = applyAgentOperations(draft(), [
      { op: "add_page", name: "Private events", path: "private-events" },
      { op: "set_words", page: "home", index: 0, words: { button_label: "Book a private event", button_page: "private-events" } },
      { op: "set_words", page: "home", index: 0, words: { button_page: "nowhere" } },
    ]);
    const hero = after.pages[0].blocks[0].config as { button_label: string; button_page: string };
    expect(hero).toMatchObject({ button_label: "Book a private event", button_page: "private-events" });
    expect(after.pages.map((p) => p.path)).toEqual(["home", "private-events"]);
    expect(after.theme.bottom_nav?.map((n) => n.page_path)).toEqual(["home", "private-events"]);
    expect(skipped).toEqual(['set_words: no page "nowhere" for the button']);
  });

  it("the original draft is untouched", () => {
    const before = draft();
    applyAgentOperations(before, [{ op: "set_words", page: "home", index: 0, words: { headline: "Changed" } }]);
    expect((before.pages[0].blocks[0].config as { headline: string }).headline).toBe("Hi");
  });
});

describe("AgentReply", () => {
  it("accepts the builder chat's operations and set_words, and rejects anything else", () => {
    expect(AgentReply.safeParse({ reply: "ok", ops: [{ op: "set_words", page: "home", index: 0, words: { headline: "x" } }, { op: "remove_block", page: "home", index: 1 }] }).success).toBe(true);
    expect(AgentReply.safeParse({ reply: "ok", ops: [{ op: "run_sql", sql: "drop table" }] }).success).toBe(false);
  });
});

describe("runAgent", () => {
  it("returns before and after without saving anything", async () => {
    const ask = vi.fn().mockResolvedValue('{"reply":"Done.","ops":[{"op":"set_words","page":"home","index":0,"words":{"headline":"New"}}]}');
    const run = await runAgent({ draft: draft(), site: "{}", instruction: "change the headline", ask });
    if ("error" in run) throw new Error(run.error);
    expect(run.applied).toBe(1);
    expect((run.before.pages[0].blocks[0].config as { headline: string }).headline).toBe("Hi");
    expect((run.after.pages[0].blocks[0].config as { headline: string }).headline).toBe("New");
    expect((ask.mock.calls[0] as string[])[1]).toContain("<owner>change the headline</owner>");
  });
  it("reports an unusable answer", async () => {
    const run = await runAgent({ draft: draft(), site: "{}", instruction: "x", ask: vi.fn().mockResolvedValue("Sure! {\"reply\": 5}") });
    expect(run).toEqual({ error: "The AI's answer couldn't be used. Try saying it a different way." });
  });
});
