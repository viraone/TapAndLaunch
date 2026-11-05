import "server-only";
import { getPublishedApp } from "@/lib/pwa/data";
import { comicFromToken, isHostToken, showProjectFor } from "@/lib/openmic/push-server";
import { automationEmailsFor } from "./config";

/**
 * Who may use the Automation tab of a published app.
 *
 * The browser holds a session for the show's own Supabase project (the comics and hosts), not a TapAndLaunch login, so
 * the caller proves who they are with `Authorization: Bearer <the show session's access token>`. Besides being one of
 * the show's hosts, the address must be listed in the Automation block's `automation_emails`; an empty or missing
 * list lets nobody in.
 */

/** Case-insensitive, trimmed email match. An empty or missing list allows nobody. */
export function isAllowedEmail(email: string, allowed: string[] | undefined): boolean {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return false;
  return (allowed ?? []).some(
    (entry) => typeof entry === "string" && entry.trim().toLowerCase() === wanted
  );
}

/** The token in `Authorization: Bearer …`, or null for a missing header or any other scheme. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer +(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export type AutomationCaller =
  | { ok: true; appId: string; appName: string; email: string; userId: string }
  | { ok: false; response: Response };

function refuse(error: string, status: number): AutomationCaller {
  return { ok: false, response: Response.json({ error }, { status }) };
}

/**
 * Checks one Automation request: the app must exist, the token must belong to a show user who is a host, and that
 * user's address must be listed for this app's Automation block. The allowed list is read on the server from the
 * app's own block — never from the request.
 */
export async function automationCaller(
  appSlug: string,
  request: Request
): Promise<AutomationCaller> {
  const token = bearerToken(request);
  if (!token) return refuse("Sign in again", 401);

  const published = await getPublishedApp(appSlug);
  if (!published) return refuse("Not found", 404);

  const project = await showProjectFor(published.app.id);
  if (!project) return refuse("This app has no open mic sign-up", 404);

  const who = await comicFromToken(project, token);
  if (!who) return refuse("Sign in again", 401);

  if (!(await isHostToken(project, token))) return refuse("Hosts only", 403);

  const allowed = await automationEmailsFor(published.app.id);
  if (!isAllowedEmail(who.email, allowed)) return refuse("Not for you", 403);

  return {
    ok: true,
    appId: published.app.id,
    appName: published.app.name,
    email: who.email,
    userId: who.id,
  };
}
