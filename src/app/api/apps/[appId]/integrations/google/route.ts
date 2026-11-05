import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { deleteConnection } from "@/lib/integrations/google/connection";

/** Disconnects the app's Gmail account: revokes the grant at Google when possible, then deletes the saved row. */
export async function DELETE(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await isAppEditor(supabase, appId))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    await deleteConnection(appId);
  } catch {
    return Response.json({ error: "Could not disconnect. Try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
