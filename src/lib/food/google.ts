import "server-only";
import type { OpeningPeriod } from "@/types/database";

/**
 * Google Places API (New) — Nearby Search for restaurants, asking for the
 * fields LiveBites needs to compute live status itself: the full weekly
 * `regularOpeningHours` and the place's `utcOffsetMinutes` (so hours are
 * evaluated in the restaurant's own time zone), plus types/rating/price
 * level for the card.
 *
 * Cost note: opening hours + rating put a call in the "Nearby Search
 * Enterprise" SKU (1,000 free/month as of Sept 2026). Nothing here
 * rate-limits — that's `nearby.ts`'s job (24-hour per-cell cache + daily
 * budget). Never call this per viewer.
 */

export interface GooglePlace {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  primaryType: string | null;
  types: string[];
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  openingPeriods: OpeningPeriod[];
  weekdayDescriptions: string[];
  utcOffsetMinutes: number | null;
  businessStatus: string | null;
}

export function isGoogleConfigured(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export async function fetchGooglePlaces(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  includedTypes: string[]
): Promise<GooglePlace[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.primaryType",
        "places.types",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.regularOpeningHours",
        "places.utcOffsetMinutes",
        "places.businessStatus",
      ].join(","),
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20, // the API's hard maximum per call
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: { center: { latitude, longitude }, radius: Math.min(radiusMeters, 50_000) },
      },
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Google Places error (${res.status}): ${body?.error?.message ?? "unknown"}`);
  }

  type Place = {
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
    types?: string[];
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    regularOpeningHours?: { periods?: OpeningPeriod[]; weekdayDescriptions?: string[] };
    utcOffsetMinutes?: number;
    businessStatus?: string;
  };

  return ((body.places ?? []) as Place[])
    .filter((p) => p.location)
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "Restaurant",
      address: p.formattedAddress ?? null,
      latitude: p.location!.latitude,
      longitude: p.location!.longitude,
      primaryType: p.primaryType ?? null,
      types: p.types ?? [],
      rating: p.rating ?? null,
      ratingCount: p.userRatingCount ?? null,
      priceLevel: p.priceLevel ? (PRICE_LEVELS[p.priceLevel] ?? null) : null,
      openingPeriods: p.regularOpeningHours?.periods ?? [],
      weekdayDescriptions: p.regularOpeningHours?.weekdayDescriptions ?? [],
      utcOffsetMinutes: p.utcOffsetMinutes ?? null,
      businessStatus: p.businessStatus ?? null,
    }));
}
