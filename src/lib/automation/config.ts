import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OpenMicSignupBlockConfig } from "@/types/database";

/**
 * The show settings an automation's emails talk about: the Open Mic Sign-Up block on one of the app's pages.
 * Same pages → blocks approach as showProjectFor in src/lib/openmic/push-server.ts.
 */
export async function openMicConfigFor(appId: string): Promise<OpenMicSignupBlockConfig | null> {
  const admin = createAdminClient();
  const { data: pages } = await admin.from("pages").select("id").eq("app_id", appId);
  const pageIds = (pages ?? []).map((page) => page.id);
  if (pageIds.length === 0) return null;

  const { data: blocks } = await admin
    .from("blocks")
    .select("config")
    .in("page_id", pageIds)
    .eq("type", "open_mic_signup");

  const configs = (blocks ?? [])
    .map((block) => block.config as OpenMicSignupBlockConfig)
    .filter((config) => config.supabase_url);

  return configs.find((config) => (config.view ?? "signup") === "signup") ?? configs[0] ?? null;
}

/**
 * The addresses allowed to use the Automation screen, from the block whose view is "automation". Undefined when the
 * app has no such block; callers treat that as "nobody".
 */
export async function automationEmailsFor(appId: string): Promise<string[] | undefined> {
  const admin = createAdminClient();
  const { data: pages } = await admin.from("pages").select("id").eq("app_id", appId);
  const pageIds = (pages ?? []).map((page) => page.id);
  if (pageIds.length === 0) return undefined;

  const { data: blocks } = await admin
    .from("blocks")
    .select("config")
    .in("page_id", pageIds)
    .eq("type", "open_mic_signup");

  const config = (blocks ?? [])
    .map((block) => block.config as OpenMicSignupBlockConfig)
    .find((candidate) => candidate.view === "automation");

  return config?.automation_emails;
}
