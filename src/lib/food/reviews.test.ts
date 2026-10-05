import { describe, expect, it } from "vitest";
import { googleUrl, shapeReviews } from "@/lib/food/reviews";

describe("googleUrl", () => {
  it("accepts https Google hosts only", () => {
    expect(googleUrl("https://www.google.com/maps/contrib/123")).toBe("https://www.google.com/maps/contrib/123");
    expect(googleUrl("https://lh3.googleusercontent.com/a/abc=s128")).toContain("googleusercontent.com");
    expect(googleUrl("http://www.google.com/x")).toBeNull();
    expect(googleUrl("https://evil.example/google.com")).toBeNull();
    expect(googleUrl("https://google.com.evil.example/x")).toBeNull();
    expect(googleUrl("javascript:alert(1)")).toBeNull();
    expect(googleUrl(undefined)).toBeNull();
  });
});

describe("shapeReviews", () => {
  const good = {
    rating: 5,
    relativePublishTimeDescription: "2 weeks ago",
    text: { text: "Great  fries\nand beer." },
    authorAttribution: { displayName: "Sam K", uri: "https://www.google.com/maps/contrib/9", photoUri: "https://lh3.googleusercontent.com/a/x" },
  };
  it("cleans a review for display", () => {
    expect(shapeReviews([good])).toEqual([
      { author: "Sam K", authorUrl: "https://www.google.com/maps/contrib/9", photoUrl: "https://lh3.googleusercontent.com/a/x", rating: 5, when: "2 weeks ago", text: "Great fries and beer." },
    ]);
  });
  it("prefers the original-language text and drops unsafe links", () => {
    const r = shapeReviews([{ ...good, originalText: { text: "Très bon" }, authorAttribution: { displayName: "Zoé", uri: "https://evil.example/p", photoUri: "http://x/y" } }]);
    expect(r[0].text).toBe("Très bon");
    expect(r[0].authorUrl).toBeNull();
    expect(r[0].photoUrl).toBeNull();
  });
  it("skips empty or rating-less entries, names the anonymous, and caps count and length", () => {
    expect(shapeReviews([{ rating: 4 }, { text: { text: "x" } }, { rating: 9, text: { text: "x" } }])).toEqual([]);
    expect(shapeReviews([{ rating: 3, text: { text: "ok" } }])[0].author).toBe("A Google user");
    expect(shapeReviews(Array.from({ length: 8 }, () => good))).toHaveLength(5);
    expect(shapeReviews([{ ...good, text: { text: "a".repeat(5000) } }])[0].text.length).toBeLessThanOrEqual(1201);
    expect(shapeReviews(null)).toEqual([]);
  });
});
