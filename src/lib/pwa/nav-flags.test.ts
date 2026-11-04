import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailNavFlag, readNavFlag, setEmailNavFlag } from "./nav-flags";

const REMEMBERED = "tl-nav-email-flag";

function fakeBrowser() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  const dispatchEvent = vi.fn();
  const fakeDocument = { cookie: "" };
  vi.stubGlobal("window", { localStorage, dispatchEvent });
  vi.stubGlobal("document", fakeDocument);
  return { store, dispatchEvent, fakeDocument };
}

describe("emailNavFlag", () => {
  it("is the same switch whatever the case or padding", () => {
    expect(emailNavFlag(" Alice@Example.com ")).toBe("openmic-email:alice@example.com");
    expect(emailNavFlag("alice@example.com")).toBe("openmic-email:alice@example.com");
  });
});

describe("setEmailNavFlag", () => {
  let browser: ReturnType<typeof fakeBrowser>;

  beforeEach(() => {
    browser = fakeBrowser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns the switch on for the signed-in address and tells the bar", () => {
    setEmailNavFlag(" Alice@Example.com ");
    expect(readNavFlag(emailNavFlag("alice@example.com"))).toBe(true);
    expect(browser.store.get(REMEMBERED)).toBe("alice@example.com");
    expect(browser.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("keeps the switch on when the same address is set again, without another redraw", () => {
    setEmailNavFlag("alice@example.com");
    setEmailNavFlag("ALICE@example.com");
    expect(readNavFlag(emailNavFlag("alice@example.com"))).toBe(true);
    expect(browser.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("moves the switch when another account signs in", () => {
    setEmailNavFlag("alice@example.com");
    setEmailNavFlag("bob@example.com");
    expect(readNavFlag(emailNavFlag("alice@example.com"))).toBe(false);
    expect(readNavFlag(emailNavFlag("bob@example.com"))).toBe(true);
    expect(browser.store.get(REMEMBERED)).toBe("bob@example.com");
  });

  it.each([null, "", "   "])("turns the switch off on sign-out (%j)", (signedOut) => {
    setEmailNavFlag("alice@example.com");
    setEmailNavFlag(signedOut);
    expect(readNavFlag(emailNavFlag("alice@example.com"))).toBe(false);
    expect(browser.store.has(REMEMBERED)).toBe(false);
    expect(browser.store.size).toBe(0);
  });

  it("never puts the address in a cookie", () => {
    setEmailNavFlag("alice@example.com");
    setEmailNavFlag(null);
    expect(browser.fakeDocument.cookie).toBe("");
  });

  it("does nothing when there is no browser", () => {
    vi.unstubAllGlobals();
    expect(() => setEmailNavFlag("alice@example.com")).not.toThrow();
  });

  it("does nothing when storage is blocked", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
      dispatchEvent: browser.dispatchEvent,
    });
    expect(() => setEmailNavFlag("alice@example.com")).not.toThrow();
    expect(browser.dispatchEvent).not.toHaveBeenCalled();
  });
});
