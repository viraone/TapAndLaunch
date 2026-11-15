import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/pwa/get-current-member";
import { findChatMember } from "@/lib/chat/access";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** One chat photo. Only signed-in people on the class list may see it; the bucket itself is private. */
export async function GET(_request: Request, context: { params: Promise<{ appSlug: string; id: string }> }) {
  const { appSlug, id } = await context.params;
  if (!/^\d{1,18}$/.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const member = await getCurrentMember(published.app.id);
  if (!member) return Response.json({ state: "sign_in" }, { status: 401, headers: NO_STORE });

  const admin = createAdminClient();
  const allowlist = await findChatMember(admin, published.app.id, member.email);
  if (!allowlist) return Response.json({ state: "not_on_list" }, { status: 403, headers: NO_STORE });

  const { data } = await admin
    .from("group_chat_messages")
    .select("image_path")
    .eq("id", Number(id))
    .eq("app_id", published.app.id)
    .maybeSingle();
  if (!data?.image_path) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: file, error } = await admin.storage.from("chat-images").download(data.image_path);
  if (error || !file) return Response.json({ error: "Not found" }, { status: 404 });

  const contentType = data.image_path.endsWith(".png") ? "image/png" : data.image_path.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(file, {
    headers: {
      "Content-Type": contentType,
      // A photo never changes once sent, but only this person's browser may keep it.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
