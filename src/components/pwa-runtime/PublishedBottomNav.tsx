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

  // Tabs marked show_if appear only once this browser's switch for them is on (lib/pwa/nav-flags.ts). The
  // snapshot is a string so it compares by value; the server render leaves them out.
  const flagged = items.filter((i) => i.show_if).map((i) => i.show_if!);
  const onFlags = useSyncExternalStore(
    subscribeNavFlags,
    () => flagged.filter(readNavFlag).join("|"),
    () => ""
  );
  const visible = items.filter((i) => !i.show_if || onFlags.split("|").includes(i.show_if));

  return (
    <BottomNav
      items={visible}
      variant={variant}
      activePagePath={activePath}
      onNavigate={(pagePath) => router.push(pagePath === homePagePath ? "/" : `/${pagePath}`)}
    />
  );
}
