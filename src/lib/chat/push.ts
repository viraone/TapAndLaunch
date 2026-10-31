import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/notifications/push";
import { pushTargetsForGroupChat, type ChatRole } from "@/lib/chat/access";

/** First line or so of a message in a phone notification. */
const ALERT_CHARS = 120;

/**
 * Tells the rest of the class that a message arrived. Runs after the POST response has gone out (the route calls it
 * through `after`), so a slow push service never delays the sender's message. Only people on the allowlist who have
 * an `app_members` account and a push subscription are reached — the sender is skipped — and a subscription the push
 * service says is gone (404/410) is deleted here. A person named in the message still gets one notification, with
 * "mentioned you" in it instead of the ordinary sender-and-preview line.
 */
export async function notifyGroupChat(
  appId: string,
  appName: string,
  senderMemberId: string,
  senderName: string,
  senderRole: ChatRole,
  body: string,
  mentioned: string[],
  page: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    const targets = await pushTargetsForGroupChat(admin, appId, senderMemberId);
    if (targets.length === 0) return;

    // "Dana (teacher): Is the mic list up yet?" — role matters to a student glancing at a locked phone.
    const who = senderRole === "teacher" ? `${senderName} (teacher)` : senderName;
    const words = body.replace(/\s+/g, " ").trim();
    const preview = words.length > ALERT_CHARS ? `${words.slice(0, ALERT_CHARS)}…` : words;
    const mentionedNames = new Set(mentioned.map((name) => name.toLowerCase()));

    const results = await Promise.allSettled(
      targets.map((target) => {
        const text = mentionedNames.has(target.displayName.toLowerCase()) ? `${who} mentioned you: ${preview}` : `${who}: ${preview}`;
        return sendPush({ endpoint: target.endpoint, p256dh: target.p256dh, auth: target.auth }, { title: appName, body: text, url: page });
      })
    );
    await Promise.all(
      results.map(async (result, i) => {
        if (result.status === "rejected") {
          console.warn("Group chat push failed:", result.reason);
          return;
        }
        if (!result.value.ok && result.value.stale) {
          await admin.from("push_subscriptions").delete().eq("id", targets[i].id);
        }
      })
    );
  } catch (error) {
    // A failed notification must never affect the message that was already saved.
    console.error("Group chat push failed:", error);
  }
}
