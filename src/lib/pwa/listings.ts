import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** One active listing as a published page hands it to the directory block:
 * the StageTime record as stored, for src/lib/listings to normalize. */
export type RuntimeListing = {
  slug: string;
  record: Record<string, unknown>;
};

/** Every active listing for an app, ordered by slug so the order is stable
 * (the directory sorts by start time, then name, on its own). */
export async function getActiveListings(appId: string): Promise<RuntimeListing[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listings")
    .select("slug, record")
    .eq("app_id", appId)
    .eq("is_active", true)
    .order("slug", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
