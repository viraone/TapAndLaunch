// StageTime "You're up next!" pushes: the pure parts shared by the comic's phone (OpenMicPushOptIn), the hosts'
// Remote tab and the server routes under published-apps/[appSlug]/openmic/. A comic's phone subscribes once;
// when a host moves the lineup spotlight, the server pushes to every phone whose stored name matches the
// highlighted row. Nothing here touches the browser or the database, so it can be tested on its own.

export interface UpNextPayload {
  title: string;
  body: string;
  url: string;
}

/** How a stage name is matched to a lineup row: case, surrounding space and runs of spaces don't count. */
export function nameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** What lands on the comic's phone. The tap opens the Sign-Up tab, where the up-next card is. */
export function upNextPayload(showName?: string): UpNextPayload {
  return {
    title: "You're up next!",
    body: `${showName?.trim() || "The show"}: head to the stage area.`,
    url: "/",
  };
}

export type PushSupport = "ok" | "ios-not-installed" | "unsupported";

/**
 * Whether this browser can take a push subscription. iPhones and iPads only allow it once the site is on the Home
 * Screen (opened standalone), so a plain Safari tab there gets its own answer and the screen can say what to do.
 */
export function pushSupport(input: { serviceWorker: boolean; pushManager: boolean; notification: boolean; userAgent: string; standalone: boolean }): PushSupport {
  if (input.serviceWorker && input.pushManager && input.notification) return "ok";
  const ios = /iPhone|iPad|iPod/i.test(input.userAgent);
  if (ios && !input.standalone) return "ios-not-installed";
  return "unsupported";
}

/** The line the host sees after moving the spotlight. */
export function upNextStatus(name: string, result: { sent: number; matched: number } | null): string {
  if (!result) return `Couldn't reach ${name}'s phone this time.`;
  if (result.sent > 0) return `Buzzed ${name}'s phone.`;
  return `${name} hasn't turned on notifications on a phone.`;
}

/** The VAPID public key (URL-safe base64) as the bytes PushManager.subscribe wants. */
export function vapidKeyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
