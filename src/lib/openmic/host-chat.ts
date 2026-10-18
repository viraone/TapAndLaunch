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

/** Flips the two tab switches for whoever is signed in, and says whether they are a host (false if unknown). */
export async function syncChatTabs(client: SupabaseClient, user: User | null): Promise<boolean> {
  if (!user) {
    setNavFlag(HOSTS_NAV_FLAG, false);
    setNavFlag(COMIC_NAV_FLAG, false);
    return false;
  }
  const { data, error } = await client.rpc("is_host_chat_member");
  if (error) return false;
  const host = data === true;
  setNavFlag(HOSTS_NAV_FLAG, host);
  setNavFlag(COMIC_NAV_FLAG, !host);
  return host;
}

const seenKey = (userId: string) => `host-chat-seen:${userId}`;

/** The newest hosts-chat message this phone has shown this host (ISO time), or null if it never has. */
export function readHostChatSeen(userId: string): string | null {
  try {
    return window.localStorage.getItem(seenKey(userId));
  } catch {
    return null;
  }
}

/** Remember how far this host has read the hosts' chat on this phone. Only moves forward. */
export function markHostChatSeen(userId: string, iso: string): void {
  try {
    const prev = window.localStorage.getItem(seenKey(userId));
    if (!prev || iso > prev) window.localStorage.setItem(seenKey(userId), iso);
  } catch {
    // Storage blocked (private mode): the card just counts from the start each time.
  }
}
