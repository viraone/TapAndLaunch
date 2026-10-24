import type { ThemeConfig } from "@/types/database";

/** Where the home page ("/") sends visitors right now, or null to show the page itself: `theme.home_redirect`
 * (an http(s) address) until `theme.home_redirect_until` (ISO 8601 with offset) has passed. With no end time the
 * redirect runs until the key is removed. StageTime: everyone to the Halloween costume-contest sign-up on
 * stagetimepnw.com until Thu Oct 29, 2026 11:00 PM, when the lineup switches on and comics need the app back. */
export function homeRedirectTarget(theme: ThemeConfig | null | undefined, now: Date = new Date()): string | null {
  const target = theme?.home_redirect;
  if (!target || !/^https?:\/\//.test(target)) return null;
  const until = theme?.home_redirect_until;
  if (until) {
    const end = new Date(until);
    if (Number.isNaN(end.getTime()) || now >= end) return null;
  }
  return target;
}
