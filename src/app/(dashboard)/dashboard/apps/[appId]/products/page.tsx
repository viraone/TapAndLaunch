import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canTakeCards } from "@/lib/stripe/accounts";
import { taxReadiness } from "@/lib/stripe/tax";
import { getStoreSettings } from "@/lib/pwa/commerce";
import { ProductsManager } from "./ProductsManager";
import { StoreSettingsCard } from "./StoreSettingsCard";

type Params = Promise<{ appId: string }>;

export default async function ProductsPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("apps")
    .select("id, name, organization_id")
    .eq("id", appId)
    .maybeSingle();
  if (!app) notFound();

  const admin = createAdminClient();
  const [{ data: products }, settings, paymentsOn] = await Promise.all([
    supabase.from("products").select("*").eq("app_id", appId).order("position", { ascending: true }),
    getStoreSettings(appId),
    canTakeCards(admin, app.organization_id),
  ]);
  // Only worth asking Stripe when there's an account to ask about.
  const tax = paymentsOn ? await taxReadiness(admin, app.organization_id) : "not_connected";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — products</h1>
        <Link href={`/dashboard/apps/${appId}/builder`} className="text-sm underline">
          Back to builder
        </Link>
      </div>
      <ProductsManager appId={appId} organizationId={app.organization_id} initialProducts={products ?? []} />
      <StoreSettingsCard appId={appId} initial={settings} paymentsOn={paymentsOn} tax={tax} />
    </main>
  );
}
