import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_ATTEMPTS } from "@/lib/reminders/due";

type LogRow = {
  id: string;
  visit_id: string;
  status: "sending" | "sent" | "failed" | "skipped";
  error: string | null;
  attempts: number;
};

function statusLabel(row: LogRow): string {
  if (row.status === "sent") return "Sent";
  if (row.status === "sending") return "Sending";
  if (row.status === "skipped") {
    return row.error === "bad_address"
      ? "Skipped (bad email address)"
      : "Skipped (no email address)";
  }

  const willRetry =
    row.attempts < MAX_ATTEMPTS && (row.error === "rate_limited" || row.error === "send_failed");
  return willRetry ? "Failed (will retry)" : "Failed (gave up)";
}

/** The last 20 automatic reminder attempts for this app, newest first. RLS lets org editors read the log. */
export async function RecentReminders({ appId, timeZone }: { appId: string; timeZone: string }) {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("reminder_log")
    .select("id, visit_id, status, error, attempts")
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = (logs ?? []) as LogRow[];
  const visitIds = [...new Set(rows.map((row) => row.visit_id))];

  const visitById = new Map<string, { customer_id: string; starts_at: string }>();
  if (visitIds.length > 0) {
    const { data: visits } = await supabase
      .from("schedule_visits")
      .select("id, customer_id, starts_at")
      .in("id", visitIds);

    for (const visit of visits ?? []) {
      visitById.set(visit.id, visit);
    }
  }

  const customerIds = [
    ...new Set(
      [...visitById.values()].map((visit) => visit.customer_id)
    ),
  ];
  const customerNameById = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from("schedule_customers")
      .select("id, name")
      .in("id", customerIds);

    for (const customer of customers ?? []) {
      customerNameById.set(customer.id, customer.name);
    }
  }

  const whenFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Recent reminders</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => {
              const visit = visitById.get(row.visit_id);
              const name = visit
                ? (customerNameById.get(visit.customer_id) ?? "Customer")
                : "Customer";
              const when = visit
                ? whenFormatter.format(new Date(visit.starts_at))
                : "";

              return (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{when}</p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-muted-foreground">
                    {statusLabel(row)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
