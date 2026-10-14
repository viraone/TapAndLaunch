import { describe, expect, it, vi } from "vitest";
import { editSectionCopy } from "./edit-section";

const site = JSON.stringify({ name: "Dave's Garage", upcoming_events: [{ title: "Open day", starts_at: "2026-10-31T19:00:00Z" }] });

describe("editSectionCopy", () => {
  it("changes only the words the model returns, keeps everything else, and does not touch the original", async () => {
    const config = { headline: "Welcome", subtext: "We fix cars.", image_url: "https://x/y.jpg", button_page: "book", button_label: "Book" };
    const ask = vi.fn().mockResolvedValue(JSON.stringify({ subtext: "We fix cars. Open day on Saturday.", image_url: "https://evil/x.jpg", extra: "no" }));
    const result = await editSectionCopy({ type: "hero", config, instruction: "mention the open day", site, ask });
    expect(result.changed).toBe(1);
    expect(result.config).toEqual({ ...config, subtext: "We fix cars. Open day on Saturday." });
    expect(config.subtext).toBe("We fix cars.");
    const [system, user] = ask.mock.calls[0] as [string, string];
    expect(system).toContain("ONE section");
    expect(user).toContain("<instruction>mention the open day</instruction>");
    expect(user).not.toContain("https://x/y.jpg");
  });

  it("can fill a blank field", async () => {
    const config = { headline: "Welcome", eyebrow: "" };
    const ask = vi.fn().mockResolvedValue(JSON.stringify({ eyebrow: "Since 1998" }));
    const result = await editSectionCopy({ type: "hero", config, instruction: "add an eyebrow", site, ask });
    expect(result.config).toEqual({ headline: "Welcome", eyebrow: "Since 1998" });
  });

  it("never blanks a field, caps lengths, and reports when nothing changed or the call failed", async () => {
    const config = { headline: "Welcome" };
    let r = await editSectionCopy({ type: "hero", config, instruction: "x", site, ask: vi.fn().mockResolvedValue(JSON.stringify({ headline: "" })) });
    expect(r.changed).toBe(0);
    r = await editSectionCopy({ type: "hero", config, instruction: "x", site, ask: vi.fn().mockResolvedValue(JSON.stringify({ headline: "w".repeat(200) })) });
    expect((r.config.headline as string).length).toBeLessThanOrEqual(80);
    r = await editSectionCopy({ type: "hero", config, instruction: "x", site, ask: vi.fn().mockRejectedValue(new Error("boom")) });
    expect(r).toEqual({ config, changed: 0, note: "boom" });
    r = await editSectionCopy({ type: "share", config: {}, instruction: "x", site, ask: vi.fn() });
    expect(r.changed).toBe(0);
  });
});
