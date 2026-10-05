import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { encryptSecret, keyHint } from "@/lib/ai/keys";
import { PROVIDER_LABELS, ProviderError, listModels, looksLikeKey, pickModel, type AiProvider } from "@/lib/ai/providers";

/**
 * The active organization's own AI key ("BYOB: Bring your own bot"). Any member can see whether one is set and its last
 * four characters; only admins can save or remove it. The key itself is never sent back to a browser.
 */
async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  const role = memberships.find((m) => m.organization_id === organizationId)?.role;
  return organizationId && role ? { user, organizationId, role } : null;
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return Response.json({ error: "Not authenticated" }, { status: 401 });
  const { data } = await createAdminClient().from("org_ai_keys").select("provider, key_hint, model").eq("organization_id", ctx.organizationId).maybeSingle();
  return Response.json({ key: data ? { provider: data.provider, hint: data.key_hint, model: data.model } : null, canManage: ctx.role === "admin" });
}

const Schema = z.object({ provider: z.enum(["anthropic", "openai"]), key: z.string().trim().min(1).max(300) });

export const maxDuration = 30;

export async function PUT(request: Request) {
  const ctx = await context();
  if (!ctx) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (ctx.role !== "admin") return Response.json({ error: "Only an organization admin can add an AI key" }, { status: 403 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a provider and paste your key" }, { status: 400 });
  const provider = parsed.data.provider as AiProvider;
  const key = parsed.data.key;
  if (!looksLikeKey(provider, key)) {
    return Response.json({ error: provider === "anthropic" ? "That doesn't look like an Anthropic key. They start with sk-ant-." : "That doesn't look like an OpenAI key. They start with sk-." }, { status: 400 });
  }

  // Prove the key works (and see which models it can use) before saving it.
  let model: string | null;
  try {
    model = pickModel(provider, await listModels(provider, key));
  } catch (error) {
    return Response.json({ error: error instanceof ProviderError ? error.message : `Couldn't reach ${PROVIDER_LABELS[provider]}. Try again.` }, { status: 400 });
  }
  if (!model) return Response.json({ error: `This key works, but it can't use any of ${PROVIDER_LABELS[provider]}'s chat models.` }, { status: 400 });

  const { error } = await createAdminClient()
    .from("org_ai_keys")
    .upsert({ organization_id: ctx.organizationId, provider, encrypted_key: encryptSecret(key), key_hint: keyHint(key), model, created_by: ctx.user.id });
  if (error) return Response.json({ error: "Couldn't save the key. Try again." }, { status: 500 });
  return Response.json({ key: { provider, hint: keyHint(key), model } });
}

export async function DELETE() {
  const ctx = await context();
  if (!ctx) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (ctx.role !== "admin") return Response.json({ error: "Only an organization admin can remove the AI key" }, { status: 403 });
  await createAdminClient().from("org_ai_keys").delete().eq("organization_id", ctx.organizationId);
  return Response.json({ key: null });
}
