/**
 * Per-browser switches that show or hide a tab marked `show_if` in the app's bottom bar (theme.bottom_nav).
 * A block that knows who is signed in sets the switch (StageTime's Hosts tab: only the hosts see it); the bar
 * listens and redraws. This only decides what the bar shows; who can read the data is enforced by the data's
 * own access rules.
 */
const EVENT = "tl-nav-flag";
const PREFIX = "tl-nav-flag:";

export function readNavFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

export function setNavFlag(key: string, on: boolean): void {
  try {
    if (on === readNavFlag(key)) return;
    if (on) window.localStorage.setItem(PREFIX + key, "1");
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Storage blocked (private mode): the tab just stays hidden.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeNavFlags(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
