/**
 * The address of the icon iOS uses for "Add to Home Screen": the icon the
 * owner uploaded in App settings, or the generated letter tile when there is
 * none. The page links a same-origin address either way — iOS 27 ignores a
 * cross-origin apple-touch-icon (and the redirect that leads to it) — and
 * the apple-touch-icon route proxies the real file. Used by the published-app
 * layout's <link rel="apple-touch-icon">; the two fallback route handlers for
 * the addresses iOS tries on its own answer with the same two choices.
 */
export function appleTouchIconHref(iconUrl: string | null | undefined): string {
  return iconUrl ? "/apple-touch-icon.png" : "/app-icon?size=180";
}
