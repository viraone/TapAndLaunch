import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { NewAppForm } from "./NewAppForm";

export default async function NewAppPage() {
  const supabase = await createClient();

  const { data: memberships } = await supabase.from("memberships").select("organization_id").limit(1);
  const organizationId = memberships?.[0]?.organization_id;
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
