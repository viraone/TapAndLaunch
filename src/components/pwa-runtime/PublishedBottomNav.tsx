"use client";

import { useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BottomNav, type BottomNavItem } from "@/components/pwa-runtime/BottomNav";
import { readNavFlag, subscribeNavFlags } from "@/lib/pwa/nav-flags";

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

  // Tabs marked show_if appear only once this browser's switch for them is on, and a tab with label_if is renamed
  // while its switch is on (lib/pwa/nav-flags.ts). The snapshot is a string so it compares by value; the server
  // render leaves the flagged tabs out and keeps the plain labels.
  const flagged = [...new Set(items.flatMap((i) => [i.show_if, i.label_if?.flag]).filter((f): f is string => !!f))];
  const onFlags = useSyncExternalStore(
    subscribeNavFlags,
    () => flagged.filter(readNavFlag).join("|"),
    () => ""
  ).split("|");
  const visible = items
    .filter((i) => !i.show_if || onFlags.includes(i.show_if))
    .map((i) => (i.label_if && onFlags.includes(i.label_if.flag) ? { ...i, label: i.label_if.label, icon: i.label_if.icon ?? i.icon } : i));

  return (
    <BottomNav
      items={visible}
      variant={variant}
      activePagePath={activePath}
      onNavigate={(pagePath) => router.push(pagePath === homePagePath ? "/" : `/${pagePath}`)}
    />
  );
}
