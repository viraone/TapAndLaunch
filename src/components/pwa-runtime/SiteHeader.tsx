import type { ThemeConfig } from "@/types/database";
import { hasAppHeader } from "@/components/pwa-runtime/AppHeader";

/**
 * The header of an app laid out as a website (`theme.layout === "website"`): the logo and name on the left and, on a
 * wide screen, the pages as a menu on the right. On a phone the menu is hidden and the tab bar at the bottom takes
 * over, so the page works like the app it also is. The menu's entries are the same `bottom_nav` items as the tab bar,
 * so the owner sets them once.
 *
 * Shared by the published site and the builder's desktop preview: `onNavigate` makes the entries buttons (the
 * builder switches pages without a real navigation); without it they are plain links.
 */
export function SiteHeader({
  theme,
  activePagePath,
  onNavigate,
}: {
  theme: ThemeConfig;
  activePagePath?: string;
  onNavigate?: (pagePath: string) => void;
}) {
  const title = theme.header_title?.trim();
  const tagline = theme.header_tagline?.trim();
  const logo = theme.header_logo_url?.trim();
  const items = (theme.bottom_nav ?? []).filter((item) => item.label && item.page_path);
  if (!hasAppHeader(theme) && items.length === 0) return null;

  return (
    <header className="@container sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-3 @lg:px-8 @lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
            <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover shadow-sm ring-1 ring-black/10 @lg:h-12 @lg:w-12" />
          )}
          {(title || tagline) && (
            <div className="min-w-0">
              {title && <p className="truncate text-xl font-extrabold leading-tight tracking-tight @lg:text-2xl">{title}</p>}
              {tagline && <p className="truncate text-sm font-medium text-muted-foreground">{tagline}</p>}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <nav aria-label="Pages" className="hidden shrink-0 items-center gap-1 @lg:flex">
            {items.map((item) => {
              const active = item.page_path === activePagePath;
              const className = `rounded-full px-4 py-2 text-[15px] font-semibold transition ${
                active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground"
              }`;
              return onNavigate ? (
                <button key={item.page_path} type="button" onClick={() => onNavigate(item.page_path)} aria-current={active ? "page" : undefined} className={className}>
                  {item.label}
                </button>
              ) : (
                <a key={item.page_path} href={`/${item.page_path}`} aria-current={active ? "page" : undefined} className={className}>
                  {item.label}
                </a>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
