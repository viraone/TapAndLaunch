import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Live food and Gas prices call Google Places, which costs money per
 * visitor, so they're off for new organizations until a platform admin
 * switches them on (`organizations.maps_enabled`, guarded in the database).
 */
/** Is Google Maps on for this organization? Reads with the service role,
 * because published apps are opened by visitors who have no account. */
export async function orgHasMaps(organizationId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select("maps_enabled").eq("id", organizationId).maybeSingle();
  return data?.maps_enabled === true;
}
