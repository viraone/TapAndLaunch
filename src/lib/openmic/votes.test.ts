import { describe, expect, it } from "vitest";
import { isPublishedSheetUrl, mayReadVotes, parseCsv, parseTallyCsv } from "./votes";

const SAMPLE = [
  "Friday Costume Contest — Results,,,,,,,Comedian (helper),Votes (helper)",
  "Updates live as votes come in. Only each ballot's first vote counts.,,,,,,,Meaghan Elwood,1",
  'Winner,"Masih Ahmad & Meaghan Elwood (tie)",,,,,,Masih Ahmad,1',
  "Valid votes counted,2,,",
  "Duplicate votes ignored,1,,",
  "Invalid IDs ignored,1,,",
  "Total submissions,4,,",
  "Ballot IDs on file,100,,",
  ",,,",
  ",,,",
  "Rank,Comedian,Votes,Share",
  "1,Masih Ahmad,1,50%",
  "1,Meaghan Elwood,1,50%",
  "3,Blake Kiltoff,0,0%",
  ",,,",
].join("\r\n");

describe("parseCsv", () => {
  it("handles quotes, doubled quotes and breaks inside quotes", () => {
    expect(parseCsv('a,"b,c","d ""e"""\n"x\ny",z')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["x\ny", "z"],
    ]);
  });
});

describe("parseTallyCsv", () => {
  it("reads the numbers, the winner and the ranking by label", () => {
    const r = parseTallyCsv(SAMPLE)!;
    expect(r.winner).toBe("Masih Ahmad & Meaghan Elwood (tie)");
    expect([r.valid, r.duplicates, r.invalid, r.total, r.ballots]).toEqual([2, 1, 1, 4, 100]);
    expect(r.rows).toEqual([
      { rank: 1, name: "Masih Ahmad", votes: 1, share: 0.5 },
      { rank: 1, name: "Meaghan Elwood", votes: 1, share: 0.5 },
      { rank: 3, name: "Blake Kiltoff", votes: 0, share: 0 },
    ]);
    expect(r.warning).toBe("");
  });

  it("passes the empty-ballot-list warning through", () => {
    const text = SAMPLE.replace(",,,\r\n,,,\r\nRank", "WARNING: the Ballots tab is empty.,,,\r\n,,,\r\nRank");
    expect(parseTallyCsv(text)!.warning).toContain("Ballots tab is empty");
  });

  it("still works when a row is added above the numbers", () => {
    expect(parseTallyCsv("Extra line,,,\n" + SAMPLE)!.valid).toBe(2);
  });

  it("returns null for a page that isn't the tally (a sign-in page, say)", () => {
    expect(parseTallyCsv("<html>Sign in</html>")).toBeNull();
    expect(parseTallyCsv("")).toBeNull();
  });
});

describe("isPublishedSheetUrl", () => {
  it("accepts only Google's published-sheet addresses", () => {
    expect(isPublishedSheetUrl("https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?gid=1001&single=true&output=csv")).toBe(true);
    expect(isPublishedSheetUrl("http://docs.google.com/spreadsheets/d/e/abc/pub")).toBe(false);
    expect(isPublishedSheetUrl("https://evil.example/spreadsheets/d/e/abc/pub")).toBe(false);
    expect(isPublishedSheetUrl("https://docs.google.com/spreadsheets/d/abc/edit")).toBe(false);
    expect(isPublishedSheetUrl("not a url")).toBe(false);
  });
});

describe("mayReadVotes", () => {
  it("lets any host in when no list is set", () => {
    expect(mayReadVotes("nick@example.com", undefined)).toBe(true);
    expect(mayReadVotes("nick@example.com", [])).toBe(true);
  });
  it("limits to the list, ignoring case and spaces", () => {
    expect(mayReadVotes(" Vxayananh@Gmail.com ", ["vxayananh@gmail.com"])).toBe(true);
    expect(mayReadVotes("nick@example.com", ["vxayananh@gmail.com"])).toBe(false);
  });
});
