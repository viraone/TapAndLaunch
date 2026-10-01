import { describe, expect, it } from "vitest";
import { normalizeInstagram } from "@/components/pwa-runtime/OpenMicSignupRuntime";

describe("normalizeInstagram", () => {
  it("turns handles and profile links into @handle", () => {
    expect(normalizeInstagram("stagetest")).toBe("@stagetest");
    expect(normalizeInstagram("@@stagetest ")).toBe("@stagetest");
    expect(normalizeInstagram("instagram.com/stagetest/")).toBe("@stagetest");
    expect(normalizeInstagram("https://www.instagram.com/stagetest?igsh=abc")).toBe("@stagetest");
    expect(normalizeInstagram("  ")).toBe("");
  });
});
