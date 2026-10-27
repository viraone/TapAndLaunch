import { PUBLIC_LIMITS, runAudit } from "seositetuneup";
import type { Report } from "seositetuneup";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRun, clientAddress, finish, hashVisitor, latestWithinCooldown, tryStart } from "@/lib/site-check/limits";
import { doneEvent, scoreEvent } from "@/lib/site-check/finish";
import { replayEvents } from "@/lib/site-check/replay";
import { encodeComment, encodeEvent } from "@/lib/site-check/sse";
import { validateSite } from "@/lib/site-check/validate";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** The public "check my site" page streams this audit as Server-Sent Events. */
export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("url");
  if (raw === null) return Response.json({ error: "Tell me which site to check — add ?url=…" }, { status: 400 });

  const v = await validateSite(raw);
  if (!v.ok) return Response.json({ error: v.message }, { status: 400 });

  if (!allowRun(clientAddress(request))) {
    return Response.json({ error: "You've checked a lot of sites lately. Give it a few minutes and try again." }, { status: 429 });
  }

  // The same site checked in the last hour replays its saved report instead of crawling again.
  const replayed = await replayIfRecent(v.host);
  if (replayed) return replayed;

  if (!tryStart()) {
    return Response.json({ error: "We're busy checking other sites right now — try again in a minute." }, { status: 429 });
  }

  return runStream(request, v.site, v.host);
}

/** The saved report for this host, replayed as SSE when it is still within the cooldown, else null. */
async function replayIfRecent(host: string): Promise<Response | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("site_checks")
      .select("id, created_at, report")
      .eq("host", host)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      console.error("site-check: cooldown lookup failed", error.message);
      return null;
    }
    const row = data?.[0];
    if (!row) return null;
    if (latestWithinCooldown([Date.parse(row.created_at)]) === null) return null;
    return replayResponse(row.id, row.created_at, row.report as unknown as Report);
  } catch (err) {
    console.error("site-check: cooldown lookup failed", err instanceof Error ? err.message : err);
    return null;
  }
}

function replayResponse(id: string, checkedAt: string, report: Report): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        controller.enqueue(encodeEvent("cached", { checkedAt }));
        for (const e of replayEvents(report, id)) controller.enqueue(encodeEvent(e.type, e));
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return sseResponse(stream);
}

function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

function runStream(request: Request, site: string, host: string): Response {
  const startedAt = Date.now();
  const abort = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (name: string, data: unknown) => {
        try {
          controller.enqueue(encodeEvent(name, data));
        } catch {
          /* client is gone */
        }
      };
      const ping = setInterval(() => {
        try {
          controller.enqueue(encodeComment("ping"));
        } catch {
          /* client is gone */
        }
      }, 15_000);

      try {
        const report = await runAudit({
          site,
          ...PUBLIC_LIMITS,
          ignorePaths: [],
          onEvent: (e) => send(e.type, e),
          signal: abort.signal,
        });

        // The crawl events are done; the route sends the speed/score steps, score and done itself, like run.ts does after runAudit.
        if (report.score !== null && !report.unreadable) {
          send("step", { type: "step", stage: "speed", state: "skip", note: "Skipped: not measured in the quick check." });
          send("step", { type: "step", stage: "score", state: "start", note: "Building the final score." });
          const s = scoreEvent(report);
          send("score", s);
          send("step", { type: "step", stage: "score", state: "done", note: `Score ${s.score}/100 (${s.grade}).` });
        } else {
          send("step", { type: "step", stage: "speed", state: "skip", note: "Skipped: the site could not be checked." });
          send("step", { type: "step", stage: "score", state: "skip", note: "Skipped: no score for a site that could not be checked." });
        }

        // Save the report so a re-check of the same site within the hour replays it, and the report page can render it.
        let id: string | null = null;
        try {
          const admin = createAdminClient();
          const { data, error } = await admin
            .from("site_checks")
            .insert({
              host,
              site,
              score: report.score,
              grade: report.grade,
              page_count: report.pages.length,
              report: report as unknown as Record<string, unknown>,
              fix_count: report.fixFirst.length,
              unreadable_reason: report.unreadable?.reason ?? null,
              visitor_hash: hashVisitor(clientAddress(request)),
              duration_ms: Date.now() - startedAt,
            })
            .select("id")
            .single();
          if (error) console.error("site-check: could not save the report", error.message);
          else if (data) id = data.id;
        } catch (err) {
          console.error("site-check: could not save the report", err instanceof Error ? err.message : err);
        }

        send("done", doneEvent(report, id));
      } catch (err) {
        if (!abort.signal.aborted) send("error", { type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        clearInterval(ping);
        finish();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return sseResponse(stream);
}
