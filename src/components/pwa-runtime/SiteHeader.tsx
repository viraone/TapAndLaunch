import type { ThemeConfig } from "@/types/database";
import { hasAppHeader } from "@/components/pwa-runtime/AppHeader";
import { lookOf } from "@/lib/pwa/look";

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
  homePagePath,
  onNavigate,
}: {
  theme: ThemeConfig;
  activePagePath?: string;
  /** The home page's path: its link goes to "/", the one address that page has for search engines. */
  homePagePath?: string;
  onNavigate?: (pagePath: string) => void;
}) {
  const title = theme.header_title?.trim();
  const tagline = theme.header_tagline?.trim();
  const logo = theme.header_logo_url?.trim();
  const items = (theme.bottom_nav ?? []).filter((item) => item.label && item.page_path);
  if (!hasAppHeader(theme) && items.length === 0) return null;
  const look = lookOf(theme);

  // Each look sits its header differently: a centred masthead with small-caps links (editorial), a bar in the colour
  // (bold), dark glass with the accent for the current page (cinematic), underlines instead of pills (split).
  const bar = {
    classic: "border-b border-border/70 bg-background/95 backdrop-blur",
    split: "border-b border-border/70 bg-background/95 backdrop-blur",
    editorial: "border-b border-border bg-background",
    bold: "bg-primary text-primary-foreground",
    cinematic: "border-b border-white/10 bg-black/60 text-white backdrop-blur",
  }[look];
  const row = look === "editorial" ? "flex-col items-center gap-3 py-5 text-center @lg:py-6" : "items-center justify-between gap-6 py-3 @lg:py-4";
  const name = {
    classic: "text-xl font-extrabold tracking-tight @lg:text-2xl",
    split: "text-xl font-bold tracking-tight @lg:text-2xl",
    editorial: "text-2xl font-bold tracking-tight @lg:text-3xl",
    bold: "text-2xl uppercase tracking-wide @lg:text-3xl",
    cinematic: "text-xl font-bold tracking-tight @lg:text-2xl",
  }[look];
  const subtle = look === "bold" ? "text-primary-foreground/80" : look === "cinematic" ? "text-white/60" : "text-muted-foreground";
  const link = (active: boolean) =>
    ({
      classic: `rounded-full px-4 py-2 text-[15px] font-semibold transition ${active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground"}`,
      split: `border-b-2 px-3 py-2 text-[15px] font-semibold transition ${active ? "border-primary text-primary" : "border-transparent text-foreground/70 hover:text-foreground"}`,
      editorial: `border-b-2 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.22em] transition ${active ? "border-[var(--accent)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`,
      bold: `rounded-[var(--button-radius,0.25rem)] px-4 py-2 text-[14px] font-bold uppercase tracking-[0.12em] transition ${active ? "bg-foreground text-background" : "text-primary-foreground/85 hover:bg-black/15"}`,
      cinematic: `px-3 py-2 text-[15px] font-semibold transition ${active ? "text-[var(--accent)] underline decoration-2 underline-offset-8" : "text-white/70 hover:text-white"}`,
    })[look];

  return (
    <header className={`@container sticky top-0 z-40 ${bar}`}>
      <div className={`mx-auto flex w-full max-w-6xl px-4 @lg:px-8 ${row}`}>
        <div className={`flex min-w-0 items-center gap-3 ${look === "editorial" ? "flex-col gap-1" : ""}`}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
            <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white object-cover shadow-sm ring-1 ring-black/10 @lg:h-12 @lg:w-12" />
          )}
          {(title || tagline) && (
            <div className="min-w-0">
              {title && (
                <p className={`truncate leading-tight ${name}`} style={{ fontFamily: "var(--font-heading, inherit)" }}>
                  {title}
                </p>
              )}
              {tagline && <p className={`truncate text-sm font-medium ${subtle}`}>{tagline}</p>}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <nav aria-label="Pages" className="hidden shrink-0 items-center gap-1 @lg:flex">
            {items.map((item) => {
              const active = item.page_path === activePagePath;
              const className = link(active);
              return onNavigate ? (
                <button key={item.page_path} type="button" onClick={() => onNavigate(item.page_path)} aria-current={active ? "page" : undefined} className={className}>
                  {item.label}
                </button>
              ) : (
                <a key={item.page_path} href={item.page_path === homePagePath ? "/" : `/${item.page_path}`} aria-current={active ? "page" : undefined} className={className}>
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
