import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnalyticsEventType } from "@/types/database";

/**
 * Writes one analytics_events row. Uses the service-role client — see the
 * migration: `analytics_events` has no anon/authenticated insert policy by
 * design, so this is the only write path.
 *
 * Deliberately swallows errors: a failed analytics write must never break
 * the visitor-facing page render that triggered it (Phase 1 has no
 * analytics dashboard reading this yet, so a dropped event here is a no-op
 * for now, not silent data loss of something already in use).
 */
export async function recordAnalyticsEvent(params: {
  appId: string;
  pageId?: string;
  memberId?: string;
  eventType: AnalyticsEventType;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("analytics_events").insert({
      app_id: params.appId,
      page_id: params.pageId,
      member_id: params.memberId,
      event_type: params.eventType,
      metadata: params.metadata ?? {},
    });
    if (error) console.error("Failed to record analytics event:", error);
  } catch (error) {
    console.error("Failed to record analytics event:", error);
  }
}
