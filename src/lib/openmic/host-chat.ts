import type { SupabaseClient, User } from "@supabase/supabase-js";
import { setNavFlag } from "@/lib/pwa/nav-flags";

/**
 * Two of StageTime's tabs depend on who is signed in: "Hosts" (show_if "openmic-hosts") for the show's hosts, and
 * "Message the Hosts" (show_if "openmic-comic") for every other signed-in comedian. Whenever a StageTime screen
 * learns who is signed in, it asks the show's database whether that person is a host (is_host_chat_member) and
 * flips the two switches; the bottom bar redraws. What each page lets a person read or post is enforced by the
 * database's own rules, not by these switches.
 */
export const HOSTS_NAV_FLAG = "openmic-hosts";
export const COMIC_NAV_FLAG = "openmic-comic";

export async function syncChatTabs(client: SupabaseClient, user: User | null): Promise<void> {
  if (!user) {
    setNavFlag(HOSTS_NAV_FLAG, false);
    setNavFlag(COMIC_NAV_FLAG, false);
    return;
  }
  const { data, error } = await client.rpc("is_host_chat_member");
  if (error) return;
  const host = data === true;
  setNavFlag(HOSTS_NAV_FLAG, host);
  setNavFlag(COMIC_NAV_FLAG, !host);
}
