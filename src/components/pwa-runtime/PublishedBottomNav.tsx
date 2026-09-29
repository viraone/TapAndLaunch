"use client";

import { useRouter, usePathname } from "next/navigation";
import { BottomNav, type BottomNavItem } from "@/components/pwa-runtime/BottomNav";

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

  return (
    <BottomNav
      items={items}
      variant={variant}
      activePagePath={activePath}
      onNavigate={(pagePath) => router.push(`/${pagePath}`)}
    />
  );
}
