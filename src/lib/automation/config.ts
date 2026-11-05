import "server-only";
import { showProjectFor } from "@/lib/openmic/push-server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OpenMicSignupBlockConfig } from "@/types/database";

/** Every Open Mic Sign-Up block on the app's pages, in no particular order. */
async function openMicBlocksFor(appId: string): Promise<OpenMicSignupBlockConfig[]> {
  const admin = createAdminClient();
  const { data: pages } = await admin.from("pages").select("id").eq("app_id", appId);
  const pageIds = (pages ?? []).map((page) => page.id);
  if (pageIds.length === 0) return [];

  const { data: blocks } = await admin
    .from("blocks")
    .select("config")
    .in("page_id", pageIds)
    .eq("type", "open_mic_signup");

  return (blocks ?? []).map((block) => block.config as OpenMicSignupBlockConfig);
}

/** The block whose view is "automation", if the app has one. */
function automationBlock(
  blocks: OpenMicSignupBlockConfig[]
): OpenMicSignupBlockConfig | null {
  return blocks.find((candidate) => candidate.view === "automation") ?? null;
}

/**
 * The show settings an automation's emails talk about: the Open Mic Sign-Up block on one of the app's pages.
 * Same pages → blocks approach as showProjectFor in src/lib/openmic/push-server.ts.
 */
export async function openMicConfigFor(appId: string): Promise<OpenMicSignupBlockConfig | null> {
  const configs = (await openMicBlocksFor(appId)).filter((config) => config.supabase_url);

  return configs.find((config) => (config.view ?? "signup") === "signup") ?? configs[0] ?? null;
}

/**
 * The addresses allowed to use the Automation screen, from the block whose view is "automation". Undefined when the
 * app has no such block; callers treat that as "nobody".
 */
export async function automationEmailsFor(appId: string): Promise<string[] | undefined> {
  return automationBlock(await openMicBlocksFor(appId))?.automation_emails;
}

/**
 * The saved contact-list function URL for the app's Automation block, or null when there is none or it cannot be
 * safely fetched. The URL must live on the show's own project; both lookups are read from the app's blocks, never
 * from a request.
 */
export async function contactListUrlFor(appId: string): Promise<string | null> {
  const config = automationBlock(await openMicBlocksFor(appId));
  if (!config) return null;

  const project = await showProjectFor(appId);
  if (!project) return null;

  return usableContactListUrl(config.contact_list_url, project.url);
}

/**
 * The saved URL if it is safe to fetch: an https URL on the same origin as the show project, with a path under
 * `/functions/v1/`. Surrounding spaces are trimmed; anything else is null.
 */
export function usableContactListUrl(raw: unknown, projectUrl: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate: URL;
  let project: URL;
  try {
    candidate = new URL(trimmed);
    project = new URL(projectUrl);
  } catch {
    return null;
  }

  if (candidate.protocol !== "https:") return null;
  if (candidate.origin !== project.origin) return null;
  if (!candidate.pathname.startsWith("/functions/v1/")) return null;

  return trimmed;
}
