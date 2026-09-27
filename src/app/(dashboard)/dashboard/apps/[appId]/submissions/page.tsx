import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ appId: string }>;

export default async function SubmissionsPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const { data: submissions } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: pages } = await supabase.from("pages").select("id, name").eq("app_id", appId);
  const pageNameById = new Map((pages ?? []).map((p) => [p.id, p.name]));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — form submissions</h1>
        <Link href={`/dashboard/apps/${appId}/builder`} className="text-sm underline">
          Back to builder
        </Link>
      </div>

      {!submissions || submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <div key={submission.id} className="rounded-md border p-4 text-sm">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{pageNameById.get(submission.page_id ?? "") ?? "Unknown page"}</span>
                <span>{new Date(submission.created_at).toLocaleString()}</span>
              </div>
              <dl className="space-y-1">
                {Object.entries(submission.data).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="font-medium">{key}:</dt>
                    <dd className="text-muted-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
