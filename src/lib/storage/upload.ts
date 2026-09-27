import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "app-assets";

/**
 * Uploads a file to the `app-assets` bucket under `{organizationId}/...` and
 * returns its public URL. RLS on `storage.objects`
 * (`supabase/migrations/0002_storage.sql`) is what actually enforces that
 * the caller may write to this org's folder — this function does no
 * authorization of its own.
 */
export async function uploadAppAsset(
  supabase: SupabaseClient,
  organizationId: string,
  file: File
): Promise<string> {
  const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  const path = `${organizationId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}
