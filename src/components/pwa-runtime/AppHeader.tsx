import type { ThemeConfig } from "@/types/database";
import { isHeaderBannerActive } from "@/lib/pwa/header-banner";
import { HeaderBanner } from "./HeaderBanner";
import { HeaderCornerLink } from "./HeaderCornerLink";
import { HeaderClock } from "./HeaderClock";
import { HostSwitch } from "./HostSwitch";

/** Does this theme ask for a header bar? Any one of the three is enough. */
export function hasAppHeader(theme: ThemeConfig): boolean {
  return !!(theme.header_title?.trim() || theme.header_tagline?.trim() || theme.header_logo_url?.trim() || theme.header_action?.page_path);
}

/**
 * The bar at the top of every page of an app: logo, name and a one-line
 * tagline. Shared by the published app and the builder's phone preview so
 * the two never drift apart. Colours come from the app's own tokens, so it
 * follows light and dark apps without extra work.
 */
export function AppHeader({ theme, hideBanner = false }: { theme: ThemeConfig; hideBanner?: boolean }) {
  if (!hasAppHeader(theme)) return null;
  const title = theme.header_title?.trim();
  const tagline = theme.header_tagline?.trim();
  const logo = theme.header_logo_url?.trim();
  const action = theme.header_action?.page_path ? theme.header_action : undefined;
  const banner = !hideBanner && isHeaderBannerActive(theme.header_banner, new Date()) ? theme.header_banner : undefined;

  const plain = (
    <header className="flex items-center gap-4 border-b border-border/70 bg-background px-4 py-4">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
        <img src={logo} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-white object-cover shadow-sm ring-1 ring-black/10" />
      )}
      <div className="min-w-0">
        {title && <p className="truncate text-2xl font-extrabold leading-tight tracking-tight">{title}</p>}
        <HeaderClock requireSignIn className={title ? "mt-1 text-[15px] font-black tabular-nums leading-none tracking-tight" : "text-3xl font-extrabold tabular-nums leading-none tracking-tight"} />
        {tagline && <p className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-snug text-muted-foreground">{tagline}</p>}
      </div>
      {action && <HeaderCornerLink href={`/${action.page_path.replace(/^\//, "")}`} label={action.label} icon={action.icon} />}
    </header>
  );

  if (banner) {
    const withBanner = (
      <header className="border-b border-border/70 bg-background px-4 pb-2 pt-6">
        <HeaderBanner banner={banner} corner={action ? <HeaderCornerLink href={`/${action.page_path.replace(/^\//, "")}`} label={action.label} icon={action.icon} /> : undefined} />
      </header>
    );
    // A host who has just signed in on this browser has no hosts cookie yet, so the server drew the flyer: swap it out at once.
    return <HostSwitch forEveryone={withBanner} forHosts={plain} />;
  }

  return plain;
}
