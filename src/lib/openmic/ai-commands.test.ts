import { describe, expect, it } from "vitest";
import {
  EDITS_NOT_LIVE,
  bareNameCommand,
  buildSystemPrompt,
  isRemovalCommand,
  matchComic,
  parseModelAnswer,
  planSpotlight,
  previewCommand,
  removalReply,
  spotlightReply,
  type LineupCommand,
} from "./ai-commands";

const LINEUP = [{ name: "Jeff Morris" }, { name: "David Chen" }, { name: "David Ortiz" }, { name: "Lori Peck" }];
const SHOW = [{ name: "Jeff Morris" }, { name: "Katie Nguyen" }, { name: "David Chen" }, { name: "Lori Peck" }];

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
      { type: "on_deck", name: "David Chen" },
      { type: "performing", name: "David Chen" },
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

  it("drops an on_deck or performing command without a name", () => {
    expect(parseModelAnswer('{"reply":"Hmm.","command":{"type":"on_deck"}}').command).toBeNull();
    expect(parseModelAnswer('{"reply":"Hmm.","command":{"type":"performing"}}').command).toBeNull();
    expect(parseModelAnswer('{"reply":"Hmm.","command":{"type":"on_deck","name":"   "}}').command).toBeNull();
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

describe("bareNameCommand", () => {
  it("reads a lone first name as on_deck with the full lineup name", () => {
    expect(bareNameCommand("katie", SHOW)).toEqual({ type: "on_deck", name: "Katie Nguyen" });
  });

  it("ignores trailing punctuation", () => {
    expect(bareNameCommand("Katie.", SHOW)).toEqual({ type: "on_deck", name: "Katie Nguyen" });
  });

  it("ignores case and surrounding spaces", () => {
    expect(bareNameCommand("  KATIE  ", SHOW)).toEqual({ type: "on_deck", name: "Katie Nguyen" });
  });

  it("reads an exact full name", () => {
    expect(bareNameCommand("Katie Nguyen", SHOW)).toEqual({ type: "on_deck", name: "Katie Nguyen" });
  });

  it("leaves a name that matches two comics to the model", () => {
    expect(bareNameCommand("david", LINEUP)).toBeNull();
  });

  it("leaves extra words to the model", () => {
    expect(bareNameCommand("remove katie", SHOW)).toBeNull();
    expect(bareNameCommand("katie on deck", SHOW)).toBeNull();
  });

  it("leaves an empty message to the model", () => {
    expect(bareNameCommand("", SHOW)).toBeNull();
    expect(bareNameCommand("   ", SHOW)).toBeNull();
  });

  it("leaves a long message to the model", () => {
    expect(bareNameCommand("x".repeat(60), SHOW)).toBeNull();
    expect(bareNameCommand("a".repeat(41), [{ name: "a".repeat(41) }])).toBeNull();
  });

  it("leaves an unknown name to the model", () => {
    expect(bareNameCommand("sam", SHOW)).toBeNull();
  });
});

describe("planSpotlight", () => {
  it("puts the spotlight on the comic named on deck, by first name", () => {
    expect(planSpotlight({ type: "on_deck", name: "Katie" }, SHOW)).toEqual({
      ok: true,
      index: 1,
      name: "Katie Nguyen",
      performing: "Jeff Morris",
    });
  });

  it("has nobody performing when the first comic is on deck", () => {
    expect(planSpotlight({ type: "on_deck", name: "Jeff" }, SHOW)).toEqual({
      ok: true,
      index: 0,
      name: "Jeff Morris",
      performing: null,
    });
  });

  it("puts the next comic on deck when one is performing", () => {
    expect(planSpotlight({ type: "performing", name: "Katie" }, SHOW)).toEqual({
      ok: true,
      index: 2,
      name: "David Chen",
      performing: "Katie Nguyen",
    });
  });

  it("refuses performing on the last comic", () => {
    expect(planSpotlight({ type: "performing", name: "Lori" }, SHOW)).toEqual({
      ok: false,
      text: "Lori Peck is the last comic, so there is nobody to put on deck.",
    });
  });

  it("asks which one when a name matches two comics", () => {
    expect(planSpotlight({ type: "on_deck", name: "David" }, LINEUP)).toEqual({
      ok: false,
      text: "Which one: David Chen or David Ortiz?",
    });
  });

  it("says when a name is not on the lineup", () => {
    expect(planSpotlight({ type: "performing", name: "Sam" }, SHOW)).toEqual({
      ok: false,
      text: "I don't see Sam on the lineup.",
    });
  });
});

describe("spotlightReply", () => {
  it("says who is on deck", () => {
    expect(spotlightReply({ ok: true, index: 0, name: "Jeff Morris", performing: null })).toBe("Jeff Morris is on deck.");
  });

  it("adds who is performing now", () => {
    expect(spotlightReply({ ok: true, index: 2, name: "David Chen", performing: "Katie Nguyen" })).toBe(
      "David Chen is on deck. Katie Nguyen is performing now."
    );
  });
});

describe("isRemovalCommand", () => {
  it("catches remove, no_show and back", () => {
    expect(isRemovalCommand({ type: "remove", name: "David Chen" })).toBe(true);
    expect(isRemovalCommand({ type: "no_show", name: "David Chen" })).toBe(true);
    expect(isRemovalCommand({ type: "back", name: "David Chen" })).toBe(true);
  });

  it("leaves the previews and a missing command alone", () => {
    expect(isRemovalCommand({ type: "add", name: "Sam", position: "end" })).toBe(false);
    expect(isRemovalCommand({ type: "move", name: "David Chen", position: "top" })).toBe(false);
    expect(isRemovalCommand({ type: "swap", name: "David Chen", other: "Lori Peck" })).toBe(false);
    expect(isRemovalCommand({ type: "undo" })).toBe(false);
    expect(isRemovalCommand(null)).toBe(false);
  });
});

describe("removalReply", () => {
  it("says what happened, in the live words", () => {
    expect(removalReply({ type: "remove", name: "English John" }, "English John")).toBe("Removed English John from tonight's lineup.");
    expect(removalReply({ type: "no_show", name: "Sam" }, "Sam")).toBe("No-show: took Sam off the lineup.");
    expect(removalReply({ type: "back", name: "English John" }, "English John")).toBe("Put English John back on the lineup.");
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

  it("previews the two live commands in the words of the live move", () => {
    expect(previewCommand({ type: "on_deck", name: "Jeff" }, SHOW)).toEqual({ ok: true, text: "Jeff Morris is on deck." });
    expect(previewCommand({ type: "on_deck", name: "Katie" }, SHOW)).toEqual({
      ok: true,
      text: "Katie Nguyen is on deck. Jeff Morris is performing now.",
    });
    expect(previewCommand({ type: "performing", name: "Katie" }, SHOW)).toEqual({
      ok: true,
      text: "David Chen is on deck. Katie Nguyen is performing now.",
    });
  });

  it("refuses a live command that cannot be made", () => {
    expect(previewCommand({ type: "performing", name: "Lori" }, SHOW)).toEqual({
      ok: false,
      text: "Lori Peck is the last comic, so there is nobody to put on deck.",
    });
    expect(previewCommand({ type: "on_deck", name: "Sam" }, SHOW)).toEqual({ ok: false, text: "I don't see Sam on the lineup." });
    expect(previewCommand({ type: "performing", name: "David" }, LINEUP)).toEqual({
      ok: false,
      text: "Which one: David Chen or David Ortiz?",
    });
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
    expect(prompt).toContain("only a comic");
    expect(prompt).toContain("Do not say a change was made unless");
    expect(prompt).toContain("Never mention any email address.");
  });

  it("lists the commands that happen right away", () => {
    const prompt = buildSystemPrompt([], null);
    expect(prompt).toContain("on_deck");
    expect(prompt).toContain("performing");
    expect(prompt).toContain("remove, no_show and back happen right away");
    expect(prompt).toContain("happen right away");
  });
});
