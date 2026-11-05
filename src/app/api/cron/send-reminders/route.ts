import { timingSafeEqual } from "node:crypto";
import { runReminderSender } from "@/lib/reminders/sender";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Constant-time check of the whole header, including the "Bearer " prefix. A different length never matches. */
function isAuthorized(authorization: string | null, secret: string): boolean {
  const given = Buffer.from(authorization ?? "", "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Vercel calls this every five minutes (see vercel.json). It takes no input from the query string or body: the only
 * thing that starts a run is the CRON_SECRET header.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runReminderSender();
  return Response.json({ ok: true, ...summary });
}
