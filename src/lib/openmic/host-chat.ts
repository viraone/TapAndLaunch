import type { SupabaseClient, User } from "@supabase/supabase-js";
import { setNavFlag } from "@/lib/pwa/nav-flags";

/**
 * StageTime's Hosts tab is marked `show_if: "openmic-hosts"` in the app's bottom bar. Whenever a StageTime screen
 * learns who is signed in, it asks the show's database whether that person is a host (is_host_chat_member) and
 * flips the switch, so only the hosts see the tab. The chat itself is protected by the database's own rules.
 */
export const HOSTS_NAV_FLAG = "openmic-hosts";

export async function syncHostsTab(client: SupabaseClient, user: User | null): Promise<void> {
  if (!user) {
    setNavFlag(HOSTS_NAV_FLAG, false);
    return;
  }
  const { data, error } = await client.rpc("is_host_chat_member");
  if (!error) setNavFlag(HOSTS_NAV_FLAG, data === true);
}
