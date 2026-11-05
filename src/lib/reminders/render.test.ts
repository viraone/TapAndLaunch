import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER,
  REMINDER_TOKENS,
  findUnknownTokens,
  reminderValues,
  renderReminder,
  renderTemplate,
} from "./render";

const PACIFIC = "America/Los_Angeles";

const ALL_VALUES: Record<string, string> = {
  first_name: "Alex",
  name: "Alex Morgan",
  date: "Tuesday, November 10",
  time: "10:00 AM",
  address: "123 Example Street",
  service: "Standard clean",
  business: "Sparkle Cleaning",
};

describe("REMINDER_TOKENS", () => {
  it("lists the seven placeholders the owner can use", () => {
    expect(REMINDER_TOKENS).toEqual([
      "first_name",
      "name",
      "date",
      "time",
      "address",
      "service",
      "business",
    ]);
  });
});

describe("renderTemplate", () => {
  it("replaces every known token", () => {
    const template = REMINDER_TOKENS.map((token) => `{${token}}`).join("|");

    expect(renderTemplate(template, ALL_VALUES)).toBe(
      "Alex|Alex Morgan|Tuesday, November 10|10:00 AM|123 Example Street|Standard clean|Sparkle Cleaning"
    );
  });

  it("leaves an unknown token untouched", () => {
    expect(renderTemplate("Hi {nickname}, this is {business}.", ALL_VALUES)).toBe(
      "Hi {nickname}, this is Sparkle Cleaning."
    );
  });

  it("turns a known token with no value into an empty string", () => {
    expect(renderTemplate("Hi {first_name}! {service}", { first_name: "Alex" })).toBe(
      "Hi Alex! "
    );
  });

  it("replaces in a single pass and never re-scans a value", () => {
    expect(
      renderTemplate("{name} and {first_name}", {
        name: "{first_name}",
        first_name: "Alex",
      })
    ).toBe("{first_name} and Alex");
  });

  it("treats braces with no name as plain text", () => {
    expect(renderTemplate("{} and { business }", ALL_VALUES)).toBe(
      "{} and Sparkle Cleaning"
    );
  });
});

describe("findUnknownTokens", () => {
  it("returns nothing when every token is known", () => {
    expect(findUnknownTokens("Hi {first_name}, see you {date}.")).toEqual([]);
  });

  it("finds unknown names once, in order", () => {
    expect(
      findUnknownTokens("{nickname} {first_name} {colour} {nickname}")
    ).toEqual(["nickname", "colour"]);
  });
});

describe("reminderValues", () => {
  const startsAt = new Date("2026-11-10T18:00:00.000Z");

  it("fills every token for a visit at 10 AM Pacific", () => {
    const values = reminderValues({
      name: "Alex Morgan",
      address: "123 Example Street",
      service: "Standard clean",
      business: "Sparkle Cleaning",
      startsAt,
      timeZone: PACIFIC,
    });

    expect(values).toEqual({
      first_name: "Alex",
      name: "Alex Morgan",
      date: "Tuesday, November 10",
      time: "10:00 AM",
      address: "123 Example Street",
      service: "Standard clean",
      business: "Sparkle Cleaning",
    });
  });

  it("keeps a late visit on its own Pacific day", () => {
    // 11 PM on November 10 in Pacific is already November 11 in UTC.
    const values = reminderValues({
      name: "Alex Morgan",
      address: null,
      service: null,
      business: "Sparkle Cleaning",
      startsAt: new Date("2026-11-11T07:00:00.000Z"),
      timeZone: PACIFIC,
    });

    expect(values.date).toBe("Tuesday, November 10");
    expect(values.time).toBe("11:00 PM");
  });

  it("uses the whole name when it is one word", () => {
    const values = reminderValues({
      name: "Madonna",
      address: null,
      service: null,
      business: "Sparkle Cleaning",
      startsAt,
      timeZone: PACIFIC,
    });

    expect(values.first_name).toBe("Madonna");
  });

  it("takes the first word and ignores extra spaces", () => {
    const values = reminderValues({
      name: "  Alex   Morgan  ",
      address: null,
      service: null,
      business: "Sparkle Cleaning",
      startsAt,
      timeZone: PACIFIC,
    });

    expect(values.first_name).toBe("Alex");
    expect(values.name).toBe("Alex Morgan");
  });

  it("sends a missing address or service as an empty string", () => {
    const values = reminderValues({
      name: "Alex Morgan",
      address: null,
      service: null,
      business: "Sparkle Cleaning",
      startsAt,
      timeZone: PACIFIC,
    });

    expect(values.address).toBe("");
    expect(values.service).toBe("");
  });
});

describe("renderReminder", () => {
  const values = ALL_VALUES;

  it("renders the default reminder", () => {
    const rendered = renderReminder(DEFAULT_REMINDER, values);

    expect(rendered.subject).toBe(
      "Reminder: Sparkle Cleaning on Tuesday, November 10 at 10:00 AM"
    );
    expect(rendered.text).toContain("Hi Alex,");
    expect(rendered.text).toContain(
      "we're scheduled to visit you on Tuesday, November 10 at 10:00 AM"
    );
    expect(rendered.text).toContain("Thank you,\nSparkle Cleaning");
  });

  it("flattens CR, LF and tabs in the subject", () => {
    const rendered = renderReminder(
      {
        subject: "  Reminder\r\nBcc: evil@example.com\t{first_name}  ",
        body: "Hi.",
        prep_note: null,
      },
      values
    );

    expect(rendered.subject).toBe("Reminder Bcc: evil@example.com Alex");
  });

  it("adds the prep note as a last section in the text", () => {
    const rendered = renderReminder(
      { subject: "Reminder", body: "Hi {first_name}.", prep_note: "Gate code 1234." },
      values
    );

    expect(rendered.text).toBe(
      "Hi Alex.\n\nBefore we arrive:\nGate code 1234."
    );
    expect(rendered.html).toContain(
      '<p style="margin:0 0 16px"><strong>Before we arrive:</strong><br>Gate code 1234.</p>'
    );
  });

  it("leaves the prep section out when the note is empty", () => {
    const rendered = renderReminder(
      { subject: "Reminder", body: "Hi {first_name}.", prep_note: "   " },
      values
    );

    expect(rendered.text).toBe("Hi Alex.");
    expect(rendered.html).not.toContain("Before we arrive");
  });

  it("escapes HTML from a customer name and the body", () => {
    const rendered = renderReminder(
      {
        subject: "Hi {first_name}",
        body: 'Hi {first_name} ({name}), <script>alert("x")</script> & more',
        prep_note: null,
      },
      { ...values, name: 'Tom & Jerry\'s "<script>"', first_name: "<b>Tom</b>" }
    );

    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more"
    );
    expect(rendered.html).toContain(
      "Tom &amp; Jerry&#39;s &quot;&lt;script&gt;&quot;"
    );
    expect(rendered.html).toContain("&lt;b&gt;Tom&lt;/b&gt;");
  });

  it("turns blank lines into paragraphs and single newlines into breaks", () => {
    const rendered = renderReminder(
      { subject: "Reminder", body: "One\nTwo\n\nThree", prep_note: null },
      values
    );

    expect(rendered.html).toContain(
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222"><p style="margin:0 0 16px">One<br>Two</p><p style="margin:0 0 16px">Three</p></div>'
    );
  });

  it("wraps the text in the same one-pass rendering rules as the subject", () => {
    const rendered = renderReminder(
      {
        subject: "{business}",
        body: "Hi {name}, {nickname}.",
        prep_note: "{service}",
      },
      values
    );

    expect(rendered.subject).toBe("Sparkle Cleaning");
    expect(rendered.text).toBe(
      "Hi Alex Morgan, {nickname}.\n\nBefore we arrive:\nStandard clean"
    );
  });
});
