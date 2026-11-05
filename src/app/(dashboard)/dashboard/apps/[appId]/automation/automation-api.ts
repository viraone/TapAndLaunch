/** Where one app's dashboard Automation routes live. The browser's session cookie signs every call. */
export function automationBase(appId: string): string {
  return `/api/apps/${appId}/automation`;
}

/** The route's plain-sentence error, or the caller's own fallback when the body has none. */
export async function automationError(
  response: Response,
  fallback: string
): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error.trim() ? body.error : fallback;
}
