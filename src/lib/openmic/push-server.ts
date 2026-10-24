import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured, sendPush } from "@/lib/notifications/push";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { nameKey, upNextPayload } from "./push";

/**
 * Server side of StageTime's "You're up next!" pushes (routes under published-apps/[appSlug]/openmic/).
 *
 * The comics and hosts are users of the show's own Supabase project, whose address and public key sit in the app's
 * open_mic_signup block. A caller proves who they are by sending the access token that project gave them; the server
 * asks that project (as them) whether the token is a user, or whether it belongs to a host.
 */

export interface ShowProject {
  url: string;
  anonKey: string;
  showName?: string;
}

/** The show's project from the app's Sign-Up block (any open_mic_signup block with a project will do). */
export async function showProjectFor(appId: string): Promise<ShowProject | null> {
  const admin = createAdminClient();
  const { data: pages } = await admin.from("pages").select("id").eq("app_id", appId);
  const pageIds = (pages ?? []).map((p) => p.id);
  if (pageIds.length === 0) return null;
  const { data: blocks } = await admin.from("blocks").select("config").in("page_id", pageIds).eq("type", "open_mic_signup");
  const configs = (blocks ?? []).map((b) => b.config as OpenMicSignupBlockConfig).filter((c) => c.supabase_url && c.anon_key);
  const config = configs.find((c) => (c.view ?? "signup") === "signup") ?? configs[0];
  return config ? { url: config.supabase_url!, anonKey: config.anon_key!, showName: config.show_name } : null;
}

function showClient(project: ShowProject, token: string): SupabaseClient {
  return createClient(project.url, project.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** The comic the token belongs to, or null for a bad or expired token. */
export async function comicFromToken(project: ShowProject, token: string): Promise<{ id: string; email: string } | null> {
  const { data, error } = await showClient(project, token).auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}

/** Whether the token belongs to one of the show's hosts (the same check the Remote tab makes). */
export async function isHostToken(project: ShowProject, token: string): Promise<boolean> {
  const { data, error } = await showClient(project, token).rpc("is_host_chat_member");
  return !error && data === true;
}

export interface UpNextResult {
  /** Phones subscribed under the highlighted name. */
  matched: number;
  /** Pushes the push services accepted. */
  sent: number;
}

/** Push "You're up next!" to every phone subscribed under this lineup name; forget phones whose subscription is gone. */
export async function sendUpNext(appId: string, name: string, showName?: string): Promise<UpNextResult> {
  if (!isPushConfigured()) return { matched: 0, sent: 0 };
  const admin = createAdminClient();
  const { data } = await admin.from("openmic_push_subscriptions").select("id, endpoint, p256dh, auth").eq("app_id", appId).eq("name_key", nameKey(name));
  const phones = data ?? [];
  const payload = upNextPayload(showName);
  const results = await Promise.allSettled(phones.map((p) => sendPush({ endpoint: p.endpoint, p256dh: p.p256dh, auth: p.auth }, payload)));
  let sent = 0;
  await Promise.all(
    results.map(async (result, i) => {
      if (result.status !== "fulfilled") return;
      if (result.value.ok) sent += 1;
      else if (result.value.stale) await admin.from("openmic_push_subscriptions").delete().eq("id", phones[i]!.id);
    })
  );
  return { matched: phones.length, sent };
}
