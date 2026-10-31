import { describe, expect, it } from "vitest";
import { findMentions, splitMentions, type ChatPerson } from "./mentions";

const classList: ChatPerson[] = [
  { name: "Maggie Smith", role: "student" },
  { name: "Hari Vilas Panjwani", role: "student" },
  { name: "Sam Lee", role: "student" },
  { name: "Sam Rivera", role: "student" },
  { name: "Dana Teacher", role: "teacher" },
];

describe("findMentions", () => {
  it("matches a full display name", () => {
    expect(findMentions("Hey @Maggie Smith, are you coming?", classList)).toEqual(["Maggie Smith"]);
  });

  it("matches a first name when it is unique", () => {
    expect(findMentions("@Maggie hi", classList)).toEqual(["Maggie Smith"]);
    expect(findMentions("@Hari hi", classList)).toEqual(["Hari Vilas Panjwani"]);
  });

  it("does not match an ambiguous first name, but does match the full name", () => {
    expect(findMentions("@Sam are you there?", classList)).toEqual([]);
    expect(findMentions("@Sam Lee are you there?", classList)).toEqual(["Sam Lee"]);
  });

  it("does not mistake an email-like word for a mention", () => {
    expect(findMentions("Write to me@gmail.com", classList)).toEqual([]);
    expect(findMentions("x@Maggie hi", classList)).toEqual([]);
  });

  it("does not match a name that is only the start of a longer word", () => {
    expect(findMentions("@Harish hello", classList)).toEqual([]);
  });

  it("matches any casing and returns the canonical display name", () => {
    expect(findMentions("@maggie SMITH", classList)).toEqual(["Maggie Smith"]);
    expect(findMentions("@MAGGIE and @maggie smith", classList)).toEqual(["Maggie Smith"]);
  });

  it("lists multiple mentions once each, in the order they appear", () => {
    expect(findMentions("@Maggie, @Hari and @Maggie again", classList)).toEqual(["Maggie Smith", "Hari Vilas Panjwani"]);
    expect(findMentions("@Hari then @Sam Lee then @Dana", classList)).toEqual(["Hari Vilas Panjwani", "Sam Lee", "Dana Teacher"]);
  });

  it("matches a mention followed by punctuation", () => {
    expect(findMentions("@Maggie, hi", classList)).toEqual(["Maggie Smith"]);
    expect(findMentions("Hi @Maggie!", classList)).toEqual(["Maggie Smith"]);
    expect(findMentions("(@Maggie)", classList)).toEqual(["Maggie Smith"]);
  });

  it("returns nothing for an empty body or an empty class list", () => {
    expect(findMentions("", classList)).toEqual([]);
    expect(findMentions("@Maggie hi", [])).toEqual([]);
  });

  it("treats punctuation in a display name as plain text", () => {
    const people: ChatPerson[] = [{ name: "Maggie O'Neil", role: "student" }];
    expect(findMentions("@Maggie O'Neil hi", people)).toEqual(["Maggie O'Neil"]);
    expect(splitMentions("@Maggie O'Neil hi", people)).toEqual([
      { text: "@Maggie O'Neil", mention: true },
      { text: " hi", mention: false },
    ]);
  });
});

describe("splitMentions", () => {
  it("marks only the mentioned text", () => {
    expect(splitMentions("Hi @Maggie!", classList)).toEqual([
      { text: "Hi ", mention: false },
      { text: "@Maggie", mention: true },
      { text: "!", mention: false },
    ]);
  });

  it("prefers the longest match at a position", () => {
    expect(splitMentions("@Hari Vilas Panjwani hi", classList)).toEqual([
      { text: "@Hari Vilas Panjwani", mention: true },
      { text: " hi", mention: false },
    ]);
  });

  it("joins back to the original body exactly", () => {
    const bodies = [
      "",
      "no mentions here",
      "Hi @Maggie Smith and @Hari, @Sam Lee too — me@gmail.com",
      "@Sam is not enough, but @Sam Rivera is",
      "@Harish is not a mention",
      "@Maggie,@Hari!",
    ];
    for (const body of bodies) {
      expect(splitMentions(body, classList).map((part) => part.text).join("")).toBe(body);
    }
  });

  it("returns one plain part when there is nobody to mention", () => {
    expect(splitMentions("@Maggie hi", [])).toEqual([{ text: "@Maggie hi", mention: false }]);
    expect(splitMentions("", [])).toEqual([]);
  });
});
