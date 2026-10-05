import { describe, expect, it } from "vitest";
import { isJobAuthorized } from "@/lib/food/jobReport";

describe("isJobAuthorized", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isJobAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isJobAuthorized("Bearer s3cret!", "s3cret")).toBe(false);
    expect(isJobAuthorized("Bearer s3cre", "s3cret")).toBe(false);
    expect(isJobAuthorized("s3cret", "s3cret")).toBe(false);
    expect(isJobAuthorized("Basic s3cret", "s3cret")).toBe(false);
    expect(isJobAuthorized(null, "s3cret")).toBe(false);
  });
  it("never matches when no secret is configured", () => {
    expect(isJobAuthorized("Bearer ", "")).toBe(false);
    expect(isJobAuthorized("Bearer ", undefined)).toBe(false);
    expect(isJobAuthorized("Bearer x", undefined)).toBe(false);
  });
});
