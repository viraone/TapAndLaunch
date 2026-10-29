import type { BottomNavItem } from "@/components/pwa-runtime/BottomNav";

/**
 * Which tabs the published app's bottom bar shows this browser: tabs marked `show_if` appear only once that
 * browser's switch is on, and a tab with `label_if` is renamed while its switch is on (lib/pwa/nav-flags.ts).
 * When the switches leave a bar that had several tabs with just one, the bar shows nothing: a lone tab is the
 * page the visitor is already on (StageTime signed out: only "Sign-Up & Lineup" was left). A bar set up with a
 * single tab on purpose is left alone.
 */
export function tabsToShow(items: BottomNavItem[], onFlags: string[]): BottomNavItem[] {
  const visible = items
    .filter((i) => !i.show_if || onFlags.includes(i.show_if))
    .map((i) => (i.label_if && onFlags.includes(i.label_if.flag) ? { ...i, label: i.label_if.label, icon: i.label_if.icon ?? i.icon } : i));
  return items.length > 1 && visible.length < 2 ? [] : visible;
}
