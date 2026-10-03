import { describe, expect, it } from "vitest";
import { NOTIFICATION_CLICK_HANDLER } from "./notification-click";

const ORIGIN = "https://errr.tapandlaunch.com";

interface FakeClient {
  url: string;
  focus: () => Promise<unknown>;
  navigate?: (url: string) => Promise<FakeClient | null>;
}

/** Runs the real handler code against a fake service worker and reports what it did. */
async function click(data: unknown, windows: Array<{ url: string; canNavigate?: boolean }>) {
  const log: string[] = [];
  const clients: FakeClient[] = windows.map((w) => {
    const c: FakeClient = { url: w.url, focus: async () => (log.push(`focus ${c.url}`), c) };
    if (w.canNavigate !== undefined) {
      c.navigate = async (to: string) => {
        if (!w.canNavigate) throw new Error("uncontrolled client");
        log.push(`navigate ${to}`);
        c.url = to;
        return c;
      };
    }
    return c;
  });
  let handler: ((e: unknown) => void) | undefined;
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => type === "notificationclick" && (handler = fn),
    clients: {
      matchAll: async () => clients,
      openWindow: async (u: string) => (log.push(`open ${u}`), null),
    },
  };
  let pending: Promise<unknown> = Promise.resolve();
  new Function("self", "fetch", "URL", NOTIFICATION_CLICK_HANDLER)(self, async () => ({}), URL);
  handler!({ notification: { close: () => log.push("close"), data }, waitUntil: (p: Promise<unknown>) => (pending = p) });
  await pending;
  return log.filter((l) => l !== "close");
}

describe("notification click", () => {
  it("opens a new tab when the app isn't open", async () => {
    expect(await click({ url: "/" }, [])).toEqual([`open ${ORIGIN}/`]);
  });

  it("focuses a tab that is already on the target page", async () => {
    expect(await click({ url: "/shop" }, [{ url: `${ORIGIN}/shop`, canNavigate: true }])).toEqual([`focus ${ORIGIN}/shop`]);
  });

  it("sends an open tab of the app to the target page and focuses it (the old code did nothing visible here)", async () => {
    expect(await click({ url: "/shop" }, [{ url: `${ORIGIN}/other`, canNavigate: true }])).toEqual([
      `navigate ${ORIGIN}/shop`,
      `focus ${ORIGIN}/shop`,
    ]);
  });

  it("opens a new tab when the open tab can't be navigated", async () => {
    expect(await click({ url: "/shop" }, [{ url: `${ORIGIN}/other`, canNavigate: false }])).toEqual([`open ${ORIGIN}/shop`]);
  });

  it("defaults to the home page when the message has no link", async () => {
    expect(await click(undefined, [])).toEqual([`open ${ORIGIN}/`]);
    expect(await click({}, [])).toEqual([`open ${ORIGIN}/`]);
  });

  it("can only open pages of this app, never another site", async () => {
    expect(await click({ url: "https://evil.example/phish" }, [])).toEqual([`open ${ORIGIN}/`]);
    expect(await click({ url: "//evil.example/x" }, [])).toEqual([`open ${ORIGIN}/`]);
  });
});
