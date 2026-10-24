import type { ThemeConfig } from "@/types/database";
import { navFlagStorageKey } from "./nav-flags";

/** Where the home page ("/") sends visitors right now, or null to show the page itself: `theme.home_redirect`
 * (an http(s) address) until `theme.home_redirect_until` (ISO 8601 with offset) has passed. With no end time the
 * redirect runs until the key is removed. StageTime: everyone to the Halloween costume-contest sign-up on
 * stagetimepnw.com until Thu Oct 29, 2026 11:00 PM, when the lineup switches on and comics need the app back; the
 * hosts' phones (switch "openmic-hosts" on) are never redirected. */
export function homeRedirectTarget(
  theme: ThemeConfig | null | undefined,
  now: Date = new Date(),
  /** Is this browser's tab switch (`home_redirect_unless`) on? From the switch's cookie (lib/pwa/nav-flags.ts). */
  hasFlag: (key: string) => boolean = () => false
): string | null {
  const target = theme?.home_redirect;
  if (!target || !/^https?:\/\//.test(target)) return null;
  if (theme?.home_redirect_unless && hasFlag(theme.home_redirect_unless)) return null;
  const until = theme?.home_redirect_until;
  if (until) {
    const end = new Date(until);
    if (Number.isNaN(end.getTime()) || now >= end) return null;
  }
  return target;
}

/** The one line of script the home page runs before it draws when a redirect is on: a browser whose tab switch
 * (`home_redirect_unless`) is on in localStorage stays, everyone else goes to `target` at once. This is what lets
 * a host's Home Screen app (its own storage, no address bar, switch set long ago) keep working with nothing to do;
 * the cookie check on the server only saves hosts the script. */
export function homeRedirectScript(target: string, unlessFlag: string | undefined): string {
  const go = `location.replace(${JSON.stringify(target)})`;
  if (!unlessFlag) return `${go};`;
  const key = JSON.stringify(navFlagStorageKey(unlessFlag));
  return `(function(){try{if(localStorage.getItem(${key})==="1")return}catch(e){}${go}})();`;
}
