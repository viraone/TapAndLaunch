import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/pwa/get-current-member";
import { recordAnalyticsEvent } from "@/lib/pwa/analytics";

const BookingSchema = z.object({
  eventId: z.string().uuid(),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
});

/**
 * Books one seat at an event. Capacity is enforced twice: the count check
 * below gives a fast, friendly 409, and the `bookings_enforce_capacity`
 * before-insert trigger (see supabase/migrations/0008_booking_capacity.sql)
 * closes the race — it locks the event's row with `select ... for update`
 * and raises 'event_fully_booked' if the seat is already taken, so two
 * concurrent requests can't both book the last one.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = BookingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("id, capacity")
    .eq("id", parsed.data.eventId)
    .eq("app_id", published.app.id)
    .maybeSingle();

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.capacity !== null) {
    const { count } = await admin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id);

    if ((count ?? 0) >= event.capacity) {
      return Response.json({ error: "This event is fully booked" }, { status: 409 });
    }
  }

  const member = await getCurrentMember(published.app.id);

  const { data: booking, error } = await admin
    .from("bookings")
    .insert({
      event_id: event.id,
      app_id: published.app.id,
      member_id: member?.id ?? null,
      customer_name: parsed.data.customerName,
      customer_email: parsed.data.customerEmail,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("event_fully_booked")) {
      return Response.json({ error: "This event is fully booked" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 400 });
  }

  await recordAnalyticsEvent({
    appId: published.app.id,
    memberId: member?.id,
    eventType: "booking_created",
    metadata: { eventId: event.id },
  });

  return Response.json({ bookingId: booking.id }, { status: 201 });
}
