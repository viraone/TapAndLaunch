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
