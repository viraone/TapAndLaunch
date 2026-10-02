import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Is the signed-in user a platform admin (someone who runs TapAndLaunch)? */
export async function isPlatformAdmin(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}
