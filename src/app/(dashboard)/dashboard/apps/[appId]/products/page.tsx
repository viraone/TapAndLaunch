import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductsManager } from "./ProductsManager";

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

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("app_id", appId)
    .order("position", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — products</h1>
        <Link href={`/dashboard/apps/${appId}/builder`} className="text-sm underline">
          Back to builder
        </Link>
      </div>
      <ProductsManager appId={appId} organizationId={app.organization_id} initialProducts={products ?? []} />
    </main>
  );
}
