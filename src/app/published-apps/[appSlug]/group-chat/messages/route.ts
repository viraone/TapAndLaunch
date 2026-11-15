import { z } from "zod";
import { after } from "next/server";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/pwa/get-current-member";
import { chatPeople, chatViewer, findChatMember, type ChatRole } from "@/lib/chat/access";
import { findMentions } from "@/lib/chat/mentions";
import { notifyGroupChat } from "@/lib/chat/push";
import { chatImageContentType, chatImageExtension, detectChatImageType, MAX_CHAT_IMAGE_BYTES } from "@/lib/chat/images";

/** Latest 200 on a first load; every poll asks only for what came after the newest id it has. */
const PAGE_SIZE = 200;

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** A page path the browser may pass as a notification's address: a plain same-origin path, nothing else. */
const PAGE_PATH = /^\/[a-z0-9/-]*$/;

const SendSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  page: z.string().optional(),
});

interface MessageDto {
  id: number;
  created_at: string;
  author_name: string;
  author_role: ChatRole;
  body: string;
  has_image: boolean;
  /** Server-computed: a message's author_member_id is never sent to another viewer. */
  mine: boolean;
}

/**
 * The group chat's poll (GET) and send (POST) endpoint. Both start from the published app, then require a signed-in
 * `app_members` account whose email is on this app's `group_chat_members` list. All reads and writes use the
 * service-role client because neither table has an RLS policy: the browser never talks to either table directly.
 */
export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const member = await getCurrentMember(published.app.id);
  if (!member) return Response.json({ state: "sign_in" }, { status: 401, headers: NO_STORE });

  const admin = createAdminClient();
  const allowlist = await findChatMember(admin, published.app.id, member.email);
  if (!allowlist) return Response.json({ state: "not_on_list" }, { status: 403, headers: NO_STORE });

  const afterRaw = new URL(request.url).searchParams.get("after");
  const afterId = afterRaw && /^\d{1,18}$/.test(afterRaw) ? Number(afterRaw) : null;

  const select = "id, created_at, author_member_id, author_name, author_role, body, image_path";
  const query = admin
    .from("group_chat_messages")
    .select(select)
    .eq("app_id", published.app.id);
  const { data, error } = afterId !== null
    ? await query.gt("id", afterId).order("id", { ascending: true }).limit(PAGE_SIZE)
    : await query.order("id", { ascending: false }).limit(PAGE_SIZE);
  if (error) {
    console.error("Group chat messages could not be read:", error.message);
    return Response.json({ state: "error" }, { status: 500, headers: NO_STORE });
  }

  // A first load asks newest-first (to get the latest 200 cheaply); the reader wants the oldest of those first.
  const rows = afterId !== null ? (data ?? []) : [...(data ?? [])].reverse();
  const messages: MessageDto[] = rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    author_name: row.author_name,
    author_role: row.author_role,
    body: row.body,
    has_image: row.image_path !== null,
    mine: row.author_member_id !== null && row.author_member_id === member.id,
  }));

  const people = await chatPeople(admin, published.app.id);
  return Response.json({ state: "ok", viewer: chatViewer(member.id, allowlist), people, messages }, { headers: NO_STORE });
}

export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const member = await getCurrentMember(published.app.id);
  if (!member) return Response.json({ state: "sign_in" }, { status: 401, headers: NO_STORE });

  const admin = createAdminClient();
  const allowlist = await findChatMember(admin, published.app.id, member.email);
  if (!allowlist) return Response.json({ state: "not_on_list" }, { status: 403, headers: NO_STORE });

  let bodyText = "";
  let pageInput: string | undefined;
  let photo: File | null = null;
  if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ error: "Type a message or add a photo" }, { status: 400, headers: NO_STORE });
    const rawBody = form.get("body");
    const rawPage = form.get("page");
    const rawImage = form.get("image");
    bodyText = typeof rawBody === "string" ? rawBody.trim() : "";
    pageInput = typeof rawPage === "string" ? rawPage : undefined;
    photo = rawImage instanceof File && rawImage.size > 0 ? rawImage : null;
    if (bodyText.length > 4000) return Response.json({ error: "Type a message up to 4,000 characters" }, { status: 400, headers: NO_STORE });
  } else {
    const parsed = SendSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Type a message up to 4,000 characters" }, { status: 400, headers: NO_STORE });
    bodyText = parsed.data.body;
    pageInput = parsed.data.page;
  }
  if (!bodyText && !photo) return Response.json({ error: "Type a message or add a photo" }, { status: 400, headers: NO_STORE });

  const page = pageInput && PAGE_PATH.test(pageInput) ? pageInput : "/group-chat";

  let imagePath: string | null = null;
  if (photo) {
    if (photo.size > MAX_CHAT_IMAGE_BYTES) return Response.json({ error: "That photo is too large" }, { status: 413, headers: NO_STORE });
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const type = detectChatImageType(bytes);
    if (!type) return Response.json({ error: "Photos must be JPEG, PNG or WebP" }, { status: 415, headers: NO_STORE });
    imagePath = `${published.app.id}/${crypto.randomUUID()}.${chatImageExtension(type)}`;
    const { error: uploadError } = await admin.storage
      .from("chat-images")
      .upload(imagePath, bytes, { contentType: chatImageContentType(type), upsert: false, cacheControl: "31536000" });
    if (uploadError) {
      console.error("Group chat photo could not be stored:", uploadError.message);
      return Response.json({ state: "error" }, { status: 500, headers: NO_STORE });
    }
  }

  const { data, error } = await admin
    .from("group_chat_messages")
    .insert({
      app_id: published.app.id,
      author_member_id: member.id,
      author_name: allowlist.display_name,
      author_role: allowlist.role,
      body: bodyText,
      image_path: imagePath,
    })
    .select("id, created_at, author_name, author_role, body, image_path")
    .single();
  if (error || !data) {
    if (imagePath) await admin.storage.from("chat-images").remove([imagePath]);
    console.error("Group chat message could not be saved:", error?.message);
    return Response.json({ state: "error" }, { status: 500, headers: NO_STORE });
  }

  const message: MessageDto = {
    id: data.id,
    created_at: data.created_at,
    author_name: data.author_name,
    author_role: data.author_role,
    body: data.body,
    has_image: data.image_path !== null,
    mine: true,
  };

  // After the response has gone out: push never delays the sender, and a failed notification never loses a message.
  // The mention check reads only display names and roles, the same list the GET response gives the composer's picker.
  after(async () => {
    try {
      const people = await chatPeople(admin, published.app.id);
      const mentioned = findMentions(bodyText, people);
      await notifyGroupChat(published.app.id, published.app.name, member.id, allowlist.display_name, allowlist.role, bodyText, mentioned, page);
    } catch (error) {
      console.error("Group chat push failed:", error);
    }
  });

  return Response.json(message, { status: 201, headers: NO_STORE });
}
