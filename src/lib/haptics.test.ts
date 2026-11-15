import { afterEach, describe, expect, it, vi } from "vitest";
import { hapticSuccess } from "./haptics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hapticSuccess", () => {
  it("uses the Vibration API when there is one", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    hapticSuccess();
    expect(vibrate).toHaveBeenCalledWith([80, 50, 80]);
  });

  it("does nothing and does not throw with no navigator and no document", () => {
    vi.stubGlobal("navigator", undefined);
    expect(() => hapticSuccess()).not.toThrow();
  });
});
