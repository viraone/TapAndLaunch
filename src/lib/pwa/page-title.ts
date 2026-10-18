/**
 * The title of one page of a published app. A page's own SEO title wins; otherwise the home page is titled with the
 * app's name (and its tagline, when a short name leaves room: a bare "Maple Street" says little in a search result)
 * and every other page with "Page · App". Never empty: a page's metadata replaces the layout's key for key (Next
 * merges them shallowly), so leaving the title unset here would leave the home page with no <title> at all.
 */
export function pageTitle(
  app: { name: string; manifest: { name?: string | null }; theme?: { header_tagline?: string | null } },
  page: { name: string; is_home: boolean; seo_title?: string | null }
): string {
  const own = page.seo_title?.trim();
  if (own) return own;
  const appName = app.manifest.name?.trim() || app.name;
  if (!page.is_home) return `${page.name} · ${appName}`;
  const tagline = app.theme?.header_tagline?.trim();
  const withTagline = `${appName}: ${tagline}`;
  return tagline && tagline !== appName && appName.length < 30 && withTagline.length <= 60 ? withTagline : appName;
}
