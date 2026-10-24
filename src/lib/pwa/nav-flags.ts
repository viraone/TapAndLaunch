/**
 * Per-browser switches that show or hide a tab marked `show_if` in the app's bottom bar (theme.bottom_nav).
 * A block that knows who is signed in sets the switch (StageTime's Hosts tab: only the hosts see it); the bar
 * listens and redraws. This only decides what the bar shows; who can read the data is enforced by the data's
 * own access rules.
 */
const EVENT = "tl-nav-flag";
const PREFIX = "tl-nav-flag:";

/** The localStorage key a switch lives under (for a script that reads it before the page draws). */
export function navFlagStorageKey(key: string): string {
  return PREFIX + key;
}

/** Each switch is mirrored in a cookie of this name ("1" while on), so the server can see it too: a home-page
 * redirect (theme.home_redirect_unless) is skipped for a browser whose switch is on, e.g. StageTime's hosts. */
export function navFlagCookieName(key: string): string {
  return `tl_nav_${key}`;
}

function writeFlagCookie(key: string, on: boolean): void {
  try {
    if (typeof document === "undefined") return;
    const base = `${navFlagCookieName(key)}=${on ? "1" : ""}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.cookie = on ? `${base}; max-age=${365 * 86400}` : `${base}; max-age=0`;
  } catch {
    // No cookies: the server just can't tell, and treats the browser like any other.
  }
}

export function readNavFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

export function setNavFlag(key: string, on: boolean): void {
  // The cookie is brought in line every time, even when the switch itself hasn't moved: a phone that turned the
  // switch on before cookies existed gets its cookie on the next screen that checks who is signed in.
  writeFlagCookie(key, on);
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
