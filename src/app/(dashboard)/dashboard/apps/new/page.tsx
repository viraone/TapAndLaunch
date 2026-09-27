import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { NewAppForm } from "./NewAppForm";

export default async function NewAppPage() {
  const supabase = await createClient();

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  if (!organizationId) redirect("/onboarding");

  return (
    <main className="mx-auto w-full max-w-sm flex-1 p-6">
      <Card>
        <CardHeader>
          <CardTitle>New app</CardTitle>
        </CardHeader>
        <CardContent>
          <NewAppForm organizationId={organizationId} rootDomain={getRootDomain()} />
        </CardContent>
      </Card>
    </main>
  );
}
