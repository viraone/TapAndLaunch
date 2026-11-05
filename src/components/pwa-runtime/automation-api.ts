import type { SupabaseClient } from "@supabase/supabase-js";

/** Where the Automation screen's routes live, relative to the published app. */
export const AUTOMATION_BASE = "/openmic/automation";

export type AutomationFetchResult =
  | { ok: true; response: Response }
  | { ok: false; signedOut: true };

/**
 * One request to the Automation routes with the show session's access token in the Authorization header. The token
 * is read from the session at call time and never kept anywhere else.
 */
export async function automationFetch(
  client: SupabaseClient,
  path: string,
  init: RequestInit = {}
): Promise<AutomationFetchResult> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, signedOut: true };

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  return { ok: true, response };
}

/** The route's plain-sentence error, or the caller's own fallback when the body has none. */
export async function automationError(
  response: Response,
  fallback: string
): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" && body.error.trim() ? body.error : fallback;
}
