import type { ThemeConfig } from "@/types/database";

export type HeaderBanner = NonNullable<ThemeConfig["header_banner"]>;

export function isHeaderBannerActive(banner: ThemeConfig["header_banner"], now: Date): boolean {
  if (!banner || !banner.title?.trim() || !banner.url?.trim()) return false;
  if (banner.until && /^\d{4}-\d{2}-\d{2}$/.test(banner.until)) {
    const seattleDate = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    return seattleDate <= banner.until;
  }
  return true;
}
