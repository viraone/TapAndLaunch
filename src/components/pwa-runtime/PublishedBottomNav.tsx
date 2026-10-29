"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BottomNav, type BottomNavItem } from "@/components/pwa-runtime/BottomNav";
import { readNavFlag, subscribeNavFlags } from "@/lib/pwa/nav-flags";
import { tabsToShow } from "@/lib/pwa/bottom-nav";

/** How long a tab's in-app page switch may take before the plain page load takes over. */
const STALL_MS = 2000;

export function PublishedBottomNav({
  items,
  variant,
  homePagePath,
}: {
  items: BottomNavItem[];
  variant?: "compact" | "tabs";
  /** The home page's path: the app's root URL ("/") shows it, so its tab is
   * the active one there. */
  homePagePath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const activePath = pathname.replace(/^\//, "") || homePagePath;

  // A tab normally switches pages inside the app. If that has not happened after a couple of seconds (seen on a phone:
  // tapping Home on StageTime's Hosts chat left the chat on screen), load the page the plain way, so a tap on a tab
  // always ends up on that tab. Only the latest tap counts.
  const latestTap = useRef(0);
  const goTo = (pagePath: string) => {
    const target = pagePath === homePagePath ? "/" : `/${pagePath}`;
    router.push(target);
    const tap = ++latestTap.current;
    window.setTimeout(() => {
      if (latestTap.current === tap && window.location.pathname !== target) window.location.assign(target);
    }, STALL_MS);
  };

  // Tabs marked show_if appear only once this browser's switch for them is on, and a tab with label_if is renamed
  // while its switch is on (lib/pwa/nav-flags.ts, lib/pwa/bottom-nav.ts; a bar left with one tab shows nothing).
  // The snapshot is a string so it compares by value; the server render leaves the flagged tabs out.
  const flagged = [...new Set(items.flatMap((i) => [i.show_if, i.label_if?.flag]).filter((f): f is string => !!f))];
  const onFlags = useSyncExternalStore(
    subscribeNavFlags,
    () => flagged.filter(readNavFlag).join("|"),
    () => ""
  ).split("|");
  const visible = tabsToShow(items, onFlags);

  // Warm every tab's route as soon as the bar is on screen (the tabs are buttons, not links, so nothing prefetches
  // them by itself): the layout and loading shell are then in hand before the tap, and the switch is immediate.
  const paths = visible.map((i) => (i.page_path === homePagePath ? "/" : `/${i.page_path}`)).join("|");
  useEffect(() => {
    for (const path of paths.split("|")) if (path && path !== pathname) router.prefetch(path);
  }, [paths, pathname, router]);

  return (
    <BottomNav
      items={visible}
      variant={variant}
      activePagePath={activePath}
      onNavigate={goTo}
    />
  );
}
