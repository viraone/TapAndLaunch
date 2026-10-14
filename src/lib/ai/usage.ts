import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Kind = Database["public"]["Tables"]["ai_generations"]["Row"]["kind"];

/** How many of each a person may do in 24 hours. Each costs a cent or two; this keeps a runaway loop or a curious
 * person from running up the bill. */
export const DAILY_LIMITS: Record<"edit" | "agent" | "inbox", number> = { edit: 80, agent: 40, inbox: 40 };

/**
 * Counts one use against the person's daily limit for this kind. Returns null when fine, or the message to show when
 * they are over it (nothing is counted then).
 */
export async function countUsage(admin: SupabaseClient<Database>, input: { userId: string; organizationId: string; kind: keyof typeof DAILY_LIMITS; details?: Record<string, unknown> }): Promise<string | null> {
  const since = new Date();
  since.setHours(since.getHours() - 24);
  const { count } = await admin.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", input.userId).eq("kind", input.kind).gte("created_at", since.toISOString());
  const limit = DAILY_LIMITS[input.kind];
  if ((count ?? 0) >= limit) return `That's today's ${limit} AI ${input.kind === "edit" ? "rewrites" : input.kind === "agent" ? "changes" : "pastes"}. Try again tomorrow.`;
  await admin.from("ai_generations").insert({ user_id: input.userId, organization_id: input.organizationId, kind: input.kind as Kind, details: input.details ?? null });
  return null;
}
