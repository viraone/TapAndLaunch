/**
 * When a new service worker takes over an open page, the page is still running the old JavaScript until it reloads.
 * This decides whether to reload now, wait, or ignore the change. Reloading must never throw away what someone is
 * typing, and must never loop.
 */
export interface UpdateState {
  /** The page was already controlled by a worker when it loaded (false on a first-ever visit: nothing to refresh). */
  hadController: boolean;
  /** The person is focused in a text field, so a reload could lose what they are typing. */
  typing: boolean;
  /** Epoch ms of the last reload this code caused (0 if none). */
  lastReloadAt: number;
  now: number;
}

export const MIN_RELOAD_GAP_MS = 30_000;

export type UpdateDecision = "ignore" | "reload" | "wait";

export function decideOnControllerChange(s: UpdateState): UpdateDecision {
  if (!s.hadController) return "ignore"; // first install: the page is already the newest
  if (s.now - s.lastReloadAt < MIN_RELOAD_GAP_MS) return "ignore"; // never loop
  return s.typing ? "wait" : "reload";
}

/**
 * The deploy a service worker file was built for: its first line is `// deploy <id>` (see lib/pwa/service-worker.ts).
 * The server hands out this file with no caching, so it is a cheap way to ask "which version is live right now?"
 */
export function deployFromWorkerText(text: string): string | null {
  const m = /^\/\/ deploy (\S+)/.exec(text);
  return m ? (m[1] as string) : null;
}

export interface DeployCheck {
  /** The deploy this page's own code came from. */
  pageDeploy: string;
  /** The deploy that is live now, from the server (null when it couldn't be read). */
  liveDeploy: string | null;
  typing: boolean;
  lastReloadAt: number;
  now: number;
}

/**
 * Some browsers never run a service worker (in-app browsers such as WhatsApp's, private tabs), and some keep an old
 * page alive in memory for days. So pages also compare their own deploy with the live one whenever they come back into
 * view, and reload when a newer one is out: never while someone is typing, and never more than once every 30 seconds.
 */
export function decideOnLiveDeploy(c: DeployCheck): UpdateDecision {
  if (!c.liveDeploy || c.pageDeploy === "dev" || c.liveDeploy === c.pageDeploy) return "ignore";
  if (c.now - c.lastReloadAt < MIN_RELOAD_GAP_MS) return "ignore";
  return c.typing ? "wait" : "reload";
}
