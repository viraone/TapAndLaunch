import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPublishedApp, isTakenDown } from "@/lib/pwa/data";
import { hostRoot } from "@/lib/tenant";
import { ServiceWorkerRegister } from "@/components/pwa-runtime/ServiceWorkerRegister";
import { deployId } from "@/lib/pwa/service-worker";
import { PublishedBottomNav } from "@/components/pwa-runtime/PublishedBottomNav";
import { MemberAccountBar } from "@/components/pwa-runtime/MemberAccountBar";
import { AppHeader } from "@/components/pwa-runtime/AppHeader";
import { PublishedSiteHeader } from "@/components/pwa-runtime/PublishedSiteHeader";
import { SiteFooter } from "@/components/pwa-runtime/SiteFooter";
import { AnnouncementBar, CookieNotice } from "@/components/pwa-runtime/SiteNotices";
import { LookProvider, RevealObserver } from "@/components/pwa-runtime/Look";
import { lookOf } from "@/lib/pwa/look";
import { getCurrentMember } from "@/lib/pwa/get-current-member";
import { orgInGoodStanding } from "@/lib/billing/standing";
import { readableOn } from "@/lib/pwa/color";
import { fontsHref, themeAttributes, themeStyle } from "@/lib/pwa/theme-style";

// `params` is typed manually (Promise<{...}>) rather than via the generated
// `LayoutProps<'/published-apps/[appSlug]'>` helper: that helper only exists after
// `next dev`/`next build`/`next typegen` has run once against these route
// files, and the plain Promise form is fully supported either way (see
// app/api-reference/file-conventions/page.md).
type Params = Promise<{ appSlug: string }>;

/** A `color_scheme: "dark"` app's colour tokens: a zinc dark palette, so the
 * shared components (the tab bar, borders, muted text) match a dark page. */
const DARK_TOKENS: Record<string, string> = {
  "--background": "#09090b",
  "--foreground": "#f4f4f5",
  "--muted": "#18181b",
  "--muted-foreground": "#a1a1aa",
  "--border": "#27272a",
};

/** Only a plain hex colour goes into the page-wide <style> below. */
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { appSlug } = await params;
  const published = await getPublishedApp(appSlug);
  if (!published) return {};

  const { manifest } = published.app;
  return {
    title: manifest.name ?? published.app.name,
    description: manifest.description,
    // Root-relative so it resolves the same from any page in the app, not
    // just its home page.
    manifest: "/manifest.webmanifest",
    // Home Screen icon on iPhone, which ignores the manifest's icons.
    icons: { apple: manifest.icon_url ?? "/app-icon?size=180" },
  };
}

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { appSlug } = await params;
  const published = await getPublishedApp(appSlug);
  if (!published) return {};

  return {
    themeColor: published.app.manifest.theme_color ?? published.app.theme.primary_color,
  };
}

export default async function PublishedAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { appSlug } = await params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    // Taken down by TapAndLaunch: say so plainly instead of a bare "not found".
    if (await isTakenDown(appSlug)) {
      return (
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-2 p-8 text-center">
          <h1 className="text-xl font-semibold">This app is unavailable</h1>
          <p className="text-sm text-muted-foreground">It was taken down for breaking TapAndLaunch&apos;s rules.</p>
        </div>
      );
    }
    notFound();
  }

  // Only when billing is enforced: an organization with an expired trial or canceled plan has its apps paused.
  if (!(await orgInGoodStanding(published.app.organization_id))) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-xl font-semibold">{published.app.name} is taking a break</h1>
        <p className="text-sm text-muted-foreground">Please check back soon.</p>
      </div>
    );
  }

  // The AI-apps domain serves AI-written apps only.
  if (published.app.kind !== "code" && hostRoot((await headers()).get("host")) === "code") notFound();

  // An AI-written app is a full-screen page of its own (shown in a sandboxed frame by the page): no phone column, bars or member sign-in.
  if (published.app.kind === "code") {
    return (
      <>
        <ServiceWorkerRegister deploy={deployId()} />
        {children}
      </>
    );
  }

  const member = await getCurrentMember(published.app.id);
  const { theme } = published.app;
  const dark = theme.color_scheme === "dark";
  const tabs = theme.bottom_nav_style === "tabs";
  // A website is full width with a top menu on a laptop; on a phone it keeps the tab bar. An app is a phone-shaped
  // column everywhere. Blocks size themselves to the column (`@container`), so the same blocks serve both.
  const website = theme.layout === "website";
  const pageBackground = dark ? theme.background_color ?? DARK_TOKENS["--background"] : undefined;
  const homePagePath = published.pages.find((page) => page.is_home)?.path;
  // Overriding `--primary` here re-themes every `bg-primary`/`text-primary`
  // usage in the subtree (Tailwind v4's `@theme inline` keeps those
  // utilities as `var(--primary)` references rather than baking the value
  // at build time — see globals.css) — this is the one CSS variable this
  // phase re-themes, along with `--primary-foreground`, which is white or
  // near-black depending on which reads better on `primary_color`.
  const style: React.CSSProperties & Record<string, string | undefined> = {
    ...(dark ? { ...DARK_TOKENS, ...(theme.background_color ? { "--background": theme.background_color } : {}) } : {}),
    ...(theme.primary_color ? { "--primary": theme.primary_color, "--primary-foreground": readableOn(theme.primary_color) } : {}),
    ...(theme.background_color ? { backgroundColor: theme.background_color } : {}),
    ...themeStyle(theme),
  };
  const fonts = fontsHref(theme);

  return (
    <div
      className={`mx-auto flex min-h-dvh w-full flex-col bg-background ${website ? "" : "max-w-md"} ${dark ? "dark text-foreground" : ""} ${tabs ? (website ? "pb-32 lg:pb-0" : "pb-32") : ""}`}
      style={style}
      {...themeAttributes(theme)}
    >
      {fonts && <link rel="stylesheet" href={fonts} />}
      {/* A dark app is dark edge to edge, including what shows past the
          column and when the page is pulled past its end on a phone. */}
      {pageBackground && HEX_COLOR.test(pageBackground) && (
        <style>{`html,body{background:${pageBackground};color-scheme:dark}`}</style>
      )}
      <ServiceWorkerRegister deploy={deployId()} />
      <RevealObserver />
      <AnnouncementBar theme={theme} />
      {theme.show_member_bar !== false && <MemberAccountBar member={member} />}
      {website ? <PublishedSiteHeader theme={theme} homePagePath={homePagePath} /> : <AppHeader theme={theme} />}
      <div className={`@container flex flex-1 flex-col overflow-y-auto ${website ? "mx-auto w-full max-w-6xl" : ""}`}>
        <LookProvider look={lookOf(theme)}>
          {children}
          <SiteFooter theme={theme} />
        </LookProvider>
      </div>
      <div className={website ? "lg:hidden" : undefined}>
        <PublishedBottomNav
          items={theme.bottom_nav ?? []}
          variant={tabs ? "tabs" : "compact"}
          homePagePath={homePagePath}
        />
      </div>
      <CookieNotice theme={theme} />
    </div>
  );
}
