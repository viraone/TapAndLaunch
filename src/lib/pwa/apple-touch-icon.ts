/**
 * The address of the icon iOS uses for "Add to Home Screen": the icon the
 * owner uploaded in App settings, or the generated letter tile when there is
 * none. Shared by the published-app layout's <link rel="apple-touch-icon">
 * and the two fallback route handlers for the addresses iOS tries on its own.
 */
export function appleTouchIconHref(iconUrl: string | null | undefined): string {
  return iconUrl ?? "/app-icon?size=180";
}
