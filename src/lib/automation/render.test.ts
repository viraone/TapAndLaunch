import { describe, expect, it } from "vitest";
import { automationValues, renderAutomation } from "./render";

const VALUES = {
  first_name: "Alex",
  name: "Alex Morgan",
  show_name: "Rickshaw Stop",
  show_date: "Friday, November 6",
  show_time: "7:30 PM",
  venue: "Rickshaw Stop",
};

describe("automationValues", () => {
  it("fills every token", () => {
    expect(
      automationValues({
        name: "Alex Morgan",
        showName: "Rickshaw Stop",
        showDate: "2026-11-06",
        showTime: "7:30 PM",
        venue: "Rickshaw Stop",
      })
    ).toEqual(VALUES);
  });

  it("takes the first word and ignores extra spaces", () => {
    const values = automationValues({
      name: "  Alex   Morgan  ",
      showName: "Rickshaw Stop",
      showDate: "2026-11-06",
      showTime: null,
      venue: null,
    });

    expect(values.first_name).toBe("Alex");
    expect(values.name).toBe("Alex Morgan");
  });

  it("uses the whole name when it is one word", () => {
    expect(
      automationValues({
        name: "Madonna",
        showName: "Rickshaw Stop",
        showDate: "2026-11-06",
        showTime: null,
        venue: null,
      }).first_name
    ).toBe("Madonna");
  });

  it("writes the show date in long form without shifting its day", () => {
    expect(
      automationValues({
        name: "Alex Morgan",
        showName: "Rickshaw Stop",
        showDate: "2026-11-06",
        showTime: null,
        venue: null,
      }).show_date
    ).toBe("Friday, November 6");
  });

  it("sends a missing show time or venue as an empty string", () => {
    const values = automationValues({
      name: "Alex Morgan",
      showName: "Rickshaw Stop",
      showDate: "2026-11-06",
      showTime: null,
      venue: null,
    });

    expect(values.show_time).toBe("");
    expect(values.venue).toBe("");
  });
});

describe("renderAutomation", () => {
  it("renders every known token in the subject and the body", () => {
    const rendered = renderAutomation(
      {
        subject: "{show_name}: {show_date} at {show_time}",
        body: "Hey {first_name} ({name}), see you at {venue} on {show_date}.",
      },
      VALUES
    );

    expect(rendered.subject).toBe("Rickshaw Stop: Friday, November 6 at 7:30 PM");
    expect(rendered.text).toBe(
      "Hey Alex (Alex Morgan), see you at Rickshaw Stop on Friday, November 6."
    );
  });

  it("leaves an unknown token as it was", () => {
    const rendered = renderAutomation(
      { subject: "Hi {nickname}", body: "See you {nickname}." },
      VALUES
    );

    expect(rendered.subject).toBe("Hi {nickname}");
    expect(rendered.text).toBe("See you {nickname}.");
  });

  it("flattens CR, LF and tabs in the subject", () => {
    const rendered = renderAutomation(
      {
        subject: "  Reminder\r\nBcc: evil@example.com\t{show_name}  ",
        body: "Hi.",
      },
      VALUES
    );

    expect(rendered.subject).toBe("Reminder Bcc: evil@example.com Rickshaw Stop");
  });

  it("escapes HTML from the values and the body", () => {
    const rendered = renderAutomation(
      {
        subject: "Hi {first_name}",
        body: 'Hi {first_name} at {venue}, <script>alert("x")</script> & more',
      },
      {
        ...VALUES,
        first_name: "<b>Tom</b>",
        venue: 'Tom & Jerry\'s "<script>"',
      }
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
    const rendered = renderAutomation(
      { subject: "Reminder", body: "One\nTwo\n\nThree" },
      VALUES
    );

    expect(rendered.html).toContain(
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222"><p style="margin:0 0 16px">One<br>Two</p><p style="margin:0 0 16px">Three</p></div>'
    );
    expect(rendered.text).toBe("One\nTwo\n\nThree");
  });
});
