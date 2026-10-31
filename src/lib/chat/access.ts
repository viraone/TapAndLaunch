import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ChatPerson } from "@/lib/chat/mentions";

/**
 * The group chat's access rules, server-side only. A viewer is allowed when the email on their signed-in
 * `app_members` account is on this app's `group_chat_members` list; the list's own `display_name` and `role` are the
 * chat identity, never the member's profile name or anything the browser sends. Nothing here is ever imported by a
 * client component (the `server-only` above makes that a build error), and no route returns another member's email.
 */

type Admin = SupabaseClient<Database>;
export type ChatRole = "student" | "teacher";

export interface ChatAllowlistMember {
  id: string;
  email: string;
  display_name: string;
  role: ChatRole;
}

/** What the chat shows about the signed-in viewer: their own name and role, and nothing else from the list. */
export interface GroupChatViewer {
  member_id: string;
  display_name: string;
  role: ChatRole;
}

/** The allowlist matches emails lower-cased and trimmed; the database stores them the same way. */
export function normalizeChatEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The allowlist row for this app and email, or null when the person is not on the list. */
export async function findChatMember(admin: Admin, appId: string, email: string): Promise<ChatAllowlistMember | null> {
  const { data } = await admin
    .from("group_chat_members")
    .select("id, email, display_name, role")
    .eq("app_id", appId)
    .eq("email", normalizeChatEmail(email))
    .maybeSingle();
  return data ?? null;
}

/** The viewer DTO the GET route returns, built from the signed-in account and the allowlist row. */
export function chatViewer(memberId: string, allowlist: ChatAllowlistMember): GroupChatViewer {
  return { member_id: memberId, display_name: allowlist.display_name, role: allowlist.role };
}

/** Everyone on the app's chat list, reduced to what the browser may see: a display name and a role, never a row id or
 * an email. The GET route hands this to the composer's @ picker; the POST route uses it to work out who was mentioned. */
export async function chatPeople(admin: Admin, appId: string): Promise<ChatPerson[]> {
  const { data } = await admin
    .from("group_chat_members")
    .select("display_name, role")
    .eq("app_id", appId)
    .order("display_name", { ascending: true });
  return (data ?? []).map((row) => ({ name: row.display_name, role: row.role }));
}

export interface ChatPushTarget {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** The target's name on the chat list, used to decide who was mentioned in a message. */
  displayName: string;
}

/**
 * Every push subscription belonging to a person on this app's chat list, except the sender. The allowlist and
 * `app_members` rows are joined in JavaScript on lower-cased email: PostgREST's `.in()` compares text exactly, and
 * the two tables were typed into at different times, so a stored capital letter must not silently drop someone.
 */
export async function pushTargetsForGroupChat(admin: Admin, appId: string, excludeMemberId: string): Promise<ChatPushTarget[]> {
  const { data: allowlist } = await admin.from("group_chat_members").select("email, display_name").eq("app_id", appId);
  const namesByEmail = new Map((allowlist ?? []).map((row) => [normalizeChatEmail(row.email), row.display_name]));
  if (namesByEmail.size === 0) return [];

  const { data: members } = await admin.from("app_members").select("id, email").eq("app_id", appId);
  const namesByMemberId = new Map(
    (members ?? [])
      .filter((member) => member.id !== excludeMemberId && namesByEmail.has(normalizeChatEmail(member.email)))
      .map((member) => [member.id, namesByEmail.get(normalizeChatEmail(member.email)) ?? ""])
  );
  if (namesByMemberId.size === 0) return [];

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, member_id, endpoint, p256dh, auth")
    .eq("app_id", appId)
    .in("member_id", [...namesByMemberId.keys()]);
  return (subscriptions ?? []).map((row) => ({
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    displayName: row.member_id ? (namesByMemberId.get(row.member_id) ?? "") : "",
  }));
}
