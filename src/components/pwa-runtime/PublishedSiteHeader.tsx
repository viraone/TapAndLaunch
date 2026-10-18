"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/pwa-runtime/SiteHeader";
import type { ThemeConfig } from "@/types/database";

/** The website header on a published site: it knows the current page so the menu can mark it. */
export function PublishedSiteHeader({ theme, homePagePath }: { theme: ThemeConfig; homePagePath?: string }) {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\//, "") || homePagePath;
  return <SiteHeader theme={theme} activePagePath={activePath} homePagePath={homePagePath} />;
}
