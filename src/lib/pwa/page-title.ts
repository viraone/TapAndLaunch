/**
 * The title of one page of a published app. A page's own SEO title wins; otherwise the home page is titled with the
 * app's name and every other page with "Page · App". Never empty: a page's metadata replaces the layout's key for key
 * (Next merges them shallowly), so leaving the title unset here would leave the home page with no <title> at all.
 */
export function pageTitle(app: { name: string; manifest: { name?: string | null } }, page: { name: string; is_home: boolean; seo_title?: string | null }): string {
  const own = page.seo_title?.trim();
  if (own) return own;
  const appName = app.manifest.name?.trim() || app.name;
  return page.is_home ? appName : `${page.name} · ${appName}`;
}
