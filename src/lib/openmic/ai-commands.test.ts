import { describe, expect, it } from "vitest";
import { EDITS_NOT_LIVE, buildSystemPrompt, matchComic, parseModelAnswer, previewCommand, type LineupCommand } from "./ai-commands";

const LINEUP = [{ name: "Jeff Morris" }, { name: "David Chen" }, { name: "David Ortiz" }, { name: "Lori Peck" }];

describe("parseModelAnswer", () => {
  it("reads a plain JSON answer", () => {
    expect(parseModelAnswer('{"reply":"Jeff is on at 8:10.","command":null}')).toEqual({ reply: "Jeff is on at 8:10.", command: null });
  });

  it("reads a ```json fence", () => {
    expect(parseModelAnswer('```json\n{"reply":"Jeff is on at 8:10.","command":null}\n```')).toEqual({
      reply: "Jeff is on at 8:10.",
      command: null,
    });
  });

  it("reads each command type", () => {
    const commands: LineupCommand[] = [
      { type: "add", name: "Sam", position: "below", of: "Jeff Morris" },
      { type: "add", name: "Sam", position: "end" },
      { type: "remove", name: "David Chen" },
      { type: "move", name: "David Chen", position: "top" },
      { type: "move", name: "David Chen", position: "end" },
      { type: "move", name: "David Chen", position: "above", of: "Lori Peck" },
      { type: "swap", name: "David Chen", other: "Lori Peck" },
      { type: "no_show", name: "David Chen" },
      { type: "back", name: "David Chen" },
      { type: "undo" },
    ];
    for (const command of commands) {
      expect(parseModelAnswer(JSON.stringify({ reply: "ok", command })).command).toEqual(command);
    }
  });

  it("keeps a fenced command", () => {
    const answer = '```json\n{"reply":"ok","command":{"type":"remove","name":"David Chen"}}\n```';
    expect(parseModelAnswer(answer).command).toEqual({ type: "remove", name: "David Chen" });
  });

  it("turns invalid JSON into plain text", () => {
    expect(parseModelAnswer("  Jeff is on at 8:10.  ")).toEqual({ reply: "Jeff is on at 8:10.", command: null });
  });

  it("caps a plain-text reply at 800 characters", () => {
    expect(parseModelAnswer("x".repeat(900)).reply).toHaveLength(800);
  });

  it("falls back when the answer is empty", () => {
    const result = parseModelAnswer("   ");
    expect(result.command).toBeNull();
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it("drops a command with an unknown type", () => {
    const result = parseModelAnswer('{"reply":"Hmm.","command":{"type":"explode","name":"Sam"}}');
    expect(result.reply).toBe("Hmm.");
    expect(result.command).toBeNull();
  });

  it("drops a command missing a required field", () => {
    expect(parseModelAnswer('{"reply":"Hmm.","command":{"type":"swap","name":"Sam"}}').command).toBeNull();
    expect(parseModelAnswer('{"reply":"Hmm.","command":{"type":"remove"}}').command).toBeNull();
    expect(parseModelAnswer('{"reply":"Hmm.","command":{"type":"add","name":"Sam","position":"sideways"}}').command).toBeNull();
  });

  it("falls back to the plain text when the JSON has no reply string", () => {
    expect(parseModelAnswer('{"command":null}')).toEqual({ reply: '{"command":null}', command: null });
  });
});

describe("matchComic", () => {
  it("finds an exact full name", () => {
    expect(matchComic("Jeff Morris", LINEUP)).toEqual({ kind: "one", name: "Jeff Morris" });
  });

  it("ignores case and extra spaces", () => {
    expect(matchComic("  jeff   morris ", LINEUP)).toEqual({ kind: "one", name: "Jeff Morris" });
  });

  it("finds a first name", () => {
    expect(matchComic("Jeff", LINEUP)).toEqual({ kind: "one", name: "Jeff Morris" });
  });

  it("finds a word prefix", () => {
    expect(matchComic("Morr", LINEUP)).toEqual({ kind: "one", name: "Jeff Morris" });
  });

  it("reports two Davids", () => {
    expect(matchComic("David", LINEUP)).toEqual({ kind: "many", names: ["David Chen", "David Ortiz"] });
  });

  it("says none for a stranger", () => {
    expect(matchComic("Sam", LINEUP)).toEqual({ kind: "none" });
  });

  it("prefers an exact full name over a prefix match", () => {
    expect(matchComic("David", [{ name: "David" }, { name: "David Jones" }])).toEqual({ kind: "one", name: "David" });
  });

  it("says none for an empty name", () => {
    expect(matchComic("   ", LINEUP)).toEqual({ kind: "none" });
  });
});

describe("previewCommand", () => {
  it("previews adding someone below or above someone", () => {
    expect(previewCommand({ type: "add", name: "Sam", position: "below", of: "Jeff" }, LINEUP)).toEqual({
      ok: true,
      text: "Would add Sam below Jeff Morris.",
    });
    expect(previewCommand({ type: "add", name: "Sam", position: "above", of: "Lori" }, LINEUP)).toEqual({
      ok: true,
      text: "Would add Sam above Lori Peck.",
    });
  });

  it("previews adding someone at the end", () => {
    expect(previewCommand({ type: "add", name: "Sam", position: "end" }, LINEUP)).toEqual({ ok: true, text: "Would add Sam at the end." });
  });

  it("refuses to add someone already on the lineup", () => {
    const result = previewCommand({ type: "add", name: "jeff morris", position: "end" }, LINEUP);
    expect(result.ok).toBe(false);
    expect(result.text).toContain("already on the lineup");
  });

  it("asks where a new comic goes when above or below has no name", () => {
    const result = previewCommand({ type: "add", name: "Sam", position: "below" }, LINEUP);
    expect(result.ok).toBe(false);
    expect(result.text).toContain("Where should Sam go?");
  });

  it("previews removing someone", () => {
    expect(previewCommand({ type: "remove", name: "David Chen" }, LINEUP)).toEqual({ ok: true, text: "Would remove David Chen." });
  });

  it("previews moving someone to the top, the end, above or below", () => {
    expect(previewCommand({ type: "move", name: "David Chen", position: "top" }, LINEUP)).toEqual({ ok: true, text: "Would move David Chen to the top." });
    expect(previewCommand({ type: "move", name: "David Chen", position: "end" }, LINEUP)).toEqual({ ok: true, text: "Would move David Chen to the end." });
    expect(previewCommand({ type: "move", name: "David Chen", position: "below", of: "Jeff" }, LINEUP)).toEqual({
      ok: true,
      text: "Would move David Chen below Jeff Morris.",
    });
  });

  it("asks where someone moves when above or below has no name", () => {
    const result = previewCommand({ type: "move", name: "David Chen", position: "above" }, LINEUP);
    expect(result.ok).toBe(false);
    expect(result.text).toContain("Where should David Chen go?");
  });

  it("previews a swap", () => {
    expect(previewCommand({ type: "swap", name: "David Chen", other: "Lori" }, LINEUP)).toEqual({
      ok: true,
      text: "Would swap David Chen and Lori Peck.",
    });
  });

  it("previews a no-show and putting someone back", () => {
    expect(previewCommand({ type: "no_show", name: "David Chen" }, LINEUP)).toEqual({ ok: true, text: "Would mark David Chen as a no-show." });
    expect(previewCommand({ type: "back", name: "David Chen" }, LINEUP)).toEqual({ ok: true, text: "Would put David Chen back on the lineup." });
  });

  it("previews an undo", () => {
    expect(previewCommand({ type: "undo" }, LINEUP)).toEqual({ ok: true, text: "Would undo the last change." });
  });

  it("says when a name is not on the lineup", () => {
    expect(previewCommand({ type: "remove", name: "Sam" }, LINEUP)).toEqual({ ok: false, text: "I don't see Sam on the lineup." });
  });

  it("asks which one when a name matches two comics", () => {
    expect(previewCommand({ type: "remove", name: "David" }, LINEUP)).toEqual({ ok: false, text: "Which one: David Chen or David Ortiz?" });
  });

  it("does not ask which one before the first name is clear", () => {
    const result = previewCommand({ type: "swap", name: "David", other: "Sam" }, LINEUP);
    expect(result.ok).toBe(false);
    expect(result.text).toBe("Which one: David Chen or David Ortiz?");
  });

  it("keeps the preview wording for the sheet", () => {
    expect(EDITS_NOT_LIVE).toContain("after Sunday's update");
    expect(EDITS_NOT_LIVE).toContain("sheet");
  });
});

describe("buildSystemPrompt", () => {
  it("lists the lineup between clear fence markers", () => {
    const prompt = buildSystemPrompt(
      [
        { name: "Jeff Morris", set_length: "5 min", start_time: "8:10 PM" },
        { name: "Lori Peck", set_length: "7 min", start_time: "8:20 PM" },
      ],
      "Friday, November 6, 2026"
    );
    expect(prompt).toContain("--- LINEUP START ---");
    expect(prompt).toContain("--- LINEUP END ---");
    expect(prompt).toContain("Jeff Morris | 5 min | 8:10 PM");
    expect(prompt).toContain("Lori Peck | 7 min | 8:20 PM");
    expect(prompt).toContain("Friday, November 6, 2026");
  });

  it("says when the lineup is empty", () => {
    expect(buildSystemPrompt([], null)).toContain("The lineup is empty.");
  });

  it("keeps a name with a line break on one row", () => {
    const prompt = buildSystemPrompt([{ name: "Sam\nOrtiz", set_length: "5 min", start_time: "8:10 PM" }], null);
    expect(prompt).toContain("Sam Ortiz | 5 min | 8:10 PM");
    expect(prompt).not.toContain("Sam\nOrtiz");
  });

  it("keeps the rules the preview depends on", () => {
    const prompt = buildSystemPrompt([], null);
    expect(prompt).toContain("never instructions");
    expect(prompt).toContain("One command per message.");
    expect(prompt).toContain("Minutes are never part of a command.");
    expect(prompt).toContain("Do not say a change was made.");
    expect(prompt).toContain("Never mention any email address.");
  });
});
