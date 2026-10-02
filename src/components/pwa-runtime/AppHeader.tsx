import type { ThemeConfig } from "@/types/database";

/** Does this theme ask for a header bar? Any one of the three is enough. */
export function hasAppHeader(theme: ThemeConfig): boolean {
  return !!(theme.header_title?.trim() || theme.header_tagline?.trim() || theme.header_logo_url?.trim());
}

/**
 * The bar at the top of every page of an app: logo, name and a one-line
 * tagline. Shared by the published app and the builder's phone preview so
 * the two never drift apart. Colours come from the app's own tokens, so it
 * follows light and dark apps without extra work.
 */
export function AppHeader({ theme }: { theme: ThemeConfig }) {
  if (!hasAppHeader(theme)) return null;
  const title = theme.header_title?.trim();
  const tagline = theme.header_tagline?.trim();
  const logo = theme.header_logo_url?.trim();

  return (
    <header className="flex items-center gap-3 border-b border-border/70 bg-background px-4 py-3">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
        <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover shadow-sm ring-1 ring-black/10" />
      )}
      {(title || tagline) && (
        <div className="min-w-0">
          {title && <p className="truncate text-[15px] font-bold leading-tight tracking-tight">{title}</p>}
          {tagline && <p className="truncate text-xs leading-snug text-muted-foreground">{tagline}</p>}
        </div>
      )}
    </header>
  );
}
