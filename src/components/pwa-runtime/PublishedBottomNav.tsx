"use client";

import { useRouter, usePathname } from "next/navigation";
import { BottomNav, type BottomNavItem } from "@/components/pwa-runtime/BottomNav";

export function PublishedBottomNav({ items }: { items: BottomNavItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const activePath = pathname.replace(/^\//, "");

  return (
    <BottomNav
      items={items}
      activePagePath={activePath}
      onNavigate={(pagePath) => router.push(`/${pagePath}`)}
    />
  );
}
