import type { ThemeConfig } from "@/types/database";

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
