import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getPublishedApp } from "@/lib/pwa/data";
import { ServiceWorkerRegister } from "@/components/pwa-runtime/ServiceWorkerRegister";
import { PublishedBottomNav } from "@/components/pwa-runtime/PublishedBottomNav";

// `params` is typed manually (Promise<{...}>) rather than via the generated
// `LayoutProps<'/published-apps/[appSlug]'>` helper: that helper only exists after
// `next dev`/`next build`/`next typegen` has run once against these route
// files, and the plain Promise form is fully supported either way (see
// app/api-reference/file-conventions/page.md).
type Params = Promise<{ appSlug: string }>;

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
  if (!published) notFound();

  const { theme } = published.app;
  // Overriding `--primary` here re-themes every `bg-primary`/`text-primary`
  // usage in the subtree (Tailwind v4's `@theme inline` keeps those
  // utilities as `var(--primary)` references rather than baking the value
  // at build time — see globals.css) — this is the one CSS variable this
  // phase re-themes; `--primary-foreground` isn't recomputed for contrast
  // against a light `primary_color`, a known limitation until theming gets
  // a proper contrast-aware palette generator.
  const style: React.CSSProperties & Record<string, string | undefined> = {
    ...(theme.primary_color ? { "--primary": theme.primary_color } : {}),
    ...(theme.background_color ? { backgroundColor: theme.background_color } : {}),
    ...(theme.font_family ? { fontFamily: theme.font_family } : {}),
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background" style={style}>
      <ServiceWorkerRegister />
      <div className="flex-1 overflow-y-auto">{children}</div>
      <PublishedBottomNav items={theme.bottom_nav ?? []} />
    </div>
  );
}
