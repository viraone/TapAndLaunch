import { describe, expect, it } from "vitest";
import { buildStarter } from "@/lib/apps/templates";
import { suggestNext, templateTextSet } from "./suggestions";

const now = new Date("2026-10-14T20:00:00Z");
const blocksOf = (templateId: string, name: string) => buildStarter(templateId, name).pages[0].blocks.map((b, i) => ({ id: `b${i}`, type: b.type, config: b.config as Record<string, unknown> }));

describe("suggestNext", () => {
  it("knows which sections still have the template's words, and which the AI may write", () => {
    const blocks = blocksOf("photography", "Mia Chen");
    const out = suggestNext({ appId: "a", appName: "Mia Chen", blocks, events: [], now });
    const words = out.filter((s) => s.id.startsWith("words:"));
    expect(words.length).toBeGreaterThan(0);
    const hero = words.find((s) => s.blockId === blocks.find((b) => b.type === "hero")?.id);
    expect(hero?.action.kind).toBe("ai");
    const reviews = words.find((s) => s.blockId === blocks.find((b) => b.type === "reviews")?.id);
    expect(reviews?.action.kind).toBe("open");
  });

  it("goes quiet once the words are the owner's", () => {
    const blocks = blocksOf("photography", "Mia Chen").map((b) => (b.type === "hero" ? { ...b, config: { ...b.config, headline: "Mia Chen photographs weddings in Tacoma", subtext: "Booking 2027 now.", eyebrow: "", image_url: "https://me.example/me.jpg" } } : b));
    const out = suggestNext({ appId: "a", appName: "Mia Chen", blocks, events: [], now });
    expect(out.find((s) => s.id === "words:b0")).toBeUndefined();
    expect(out.find((s) => s.id === "photo:b0")).toBeUndefined();
  });

  it("notices a show just added that the banner doesn't mention, first", () => {
    const blocks = [{ id: "h", type: "hero", config: { headline: "Come laugh with me", subtext: "Stand-up", image_url: "https://me.example/me.jpg" } }];
    const events = [{ id: "e1", title: "Halloween Laughs", starts_at: "2026-10-17T03:00:00Z", description: null, created_at: "2026-10-13T00:00:00Z" }];
    const out = suggestNext({ appId: "a", appName: "David", blocks, events, now });
    expect(out[0]).toMatchObject({ id: "event:e1", blockId: "h", action: { kind: "ai" } });
    expect(out[0].title).toMatch(/You added Halloween Laughs/);
    // Mentioned already: nothing to say.
    const mentioned = suggestNext({ appId: "a", appName: "David", blocks: [{ ...blocks[0], config: { ...blocks[0].config, subtext: "Halloween Laughs this Friday" } }], events, now });
    expect(mentioned.find((s) => s.id === "event:e1")).toBeUndefined();
  });

  it("points at template photos and sample events", () => {
    const blocks = [
      { id: "h", type: "hero", config: { headline: "x", image_url: "https://tapandlaunch.com/templates/business-hero.jpg" } },
      { id: "g", type: "gallery", config: { images: [{ src: "https://tapandlaunch.com/templates/a.jpg" }, { src: "https://me.example/1.jpg" }] } },
    ];
    const events = [{ id: "s", title: "Sample", starts_at: "2026-10-20T00:00:00Z", description: "This is a sample. Edit it or delete it under Manage, Events.", created_at: "2026-10-01T00:00:00Z" }];
    const out = suggestNext({ appId: "a", appName: "X", blocks, events, now });
    expect(out.map((s) => s.id)).toEqual(["sample-events", "photo:h", "photo:g"]);
    expect(out[0].action).toMatchObject({ kind: "link", href: "/dashboard/apps/a/events" });
    expect(out[2].title).toBe("The gallery has 1 template photo");
  });

  it("caches the template text per name", () => {
    expect(templateTextSet("A")).toBe(templateTextSet("A"));
    expect(templateTextSet("A").size).toBeGreaterThan(50);
  });
});
