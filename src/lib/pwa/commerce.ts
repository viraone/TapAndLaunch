import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { canTakeCards } from "@/lib/stripe/accounts";
import { canPayByCard } from "@/lib/stripe/checkout";
import type { RuntimeProduct } from "@/components/pwa-runtime/ProductBuyRuntime";
import type { RuntimeEvent } from "@/components/pwa-runtime/EventBookRuntime";

/** Every active product for an app, in display order — see the migration
 * comment on `products` for why there's no per-block curation to filter by. */
export async function getActiveProducts(appId: string, organizationId: string): Promise<RuntimeProduct[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("id, name, description, price_cents, currency, image_url")
    .eq("app_id", appId)
    .eq("is_active", true)
    .order("position", { ascending: true });

  if (error) throw error;
  // With card payments on, Stripe's page collects the shopper's name and email, so the buy form skips them.
  const cards = await canTakeCards(admin, organizationId);
  return (data ?? []).map((p) => ({ ...p, card_checkout: cards && canPayByCard(p.price_cents) }));
}

/**
 * Every future event for an app, each with its current booking count (so
 * `EventBookRuntime` can show "Fully booked" without a second round trip
 * per event). Two queries, not an embedded select — see the
 * `Relationships: []` note in `types/database.ts`.
 */
export async function getUpcomingEvents(appId: string): Promise<RuntimeEvent[]> {
  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("events")
    .select("id, title, description, location, starts_at, ends_at, capacity")
    .eq("app_id", appId)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) throw error;
  if (!events || events.length === 0) return [];

  const { data: bookings, error: bookingsError } = await admin
    .from("bookings")
    .select("event_id")
    .in(
      "event_id",
      events.map((e) => e.id)
    );

  if (bookingsError) throw bookingsError;

  const countByEventId = new Map<string, number>();
  for (const booking of bookings ?? []) {
    countByEventId.set(booking.event_id, (countByEventId.get(booking.event_id) ?? 0) + 1);
  }

  return events.map((event) => ({ ...event, bookedCount: countByEventId.get(event.id) ?? 0 }));
}
