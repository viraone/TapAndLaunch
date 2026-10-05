import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CodeFiles } from "./files";

type Client = SupabaseClient<Database>;

export interface VersionInfo {
  version: number;
  summary: string | null;
  created_at: string;
}

/** The newest saved version of a code app (with its files), or null if there is none. */
export async function latestVersion(supabase: Client, appId: string): Promise<{ version: number; files: CodeFiles } | null> {
  const { data } = await supabase.from("app_code_versions").select("version, files").eq("app_id", appId).order("version", { ascending: false }).limit(1).maybeSingle();
  return data ? { version: data.version, files: data.files as CodeFiles } : null;
}

export async function listVersions(supabase: Client, appId: string, limit = 50): Promise<VersionInfo[]> {
  const { data } = await supabase.from("app_code_versions").select("version, summary, created_at").eq("app_id", appId).order("version", { ascending: false }).limit(limit);
  return data ?? [];
}

/** Saves a new version after the newest one. Returns the new number, or an error message. */
export async function saveVersion(supabase: Client, input: { appId: string; files: CodeFiles; prompt: string | null; summary: string | null; userId: string }): Promise<{ version: number } | { error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await latestVersion(supabase, input.appId);
    const version = (current?.version ?? 0) + 1;
    const { error } = await supabase.from("app_code_versions").insert({ app_id: input.appId, version, files: input.files, prompt: input.prompt, summary: input.summary, created_by: input.userId });
    if (!error) return { version };
    if (error.code !== "23505") return { error: error.message }; // only "someone saved at the same moment" is worth another try
  }
  return { error: "Couldn't save the new version. Try again." };
}
