import "server-only";
import type { FuelGrade } from "@/types/database";

/**
 * Google Places API (New) — Nearby Search restricted to gas stations, asking
 * for `fuelOptions`, which is the per-station, per-grade price data Google
 * Maps itself displays (with an "as of" time per grade).
 *
 * Cost note: `fuelOptions` puts a call in the "Nearby Search Enterprise +
 * Atmosphere" SKU (1,000 free/month, then $40/1k as of Sept 2026). Nothing
 * in this file rate-limits — that's `nearby.ts`'s job (per-cell cache +
 * daily budget). Never call this per viewer.
 */

const GOOGLE_TYPE_TO_GRADE: Record<string, FuelGrade> = {
  REGULAR_UNLEADED: "regular",
  MIDGRADE: "midgrade",
  PREMIUM: "premium",
  DIESEL: "diesel",
};

export interface GoogleStation {
  placeId: string;
  name: string;
  brand: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  prices: Partial<Record<FuelGrade, { price: number; updatedAt: string }>>;
}

export function isGoogleConfigured(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}

/** Google returns Money as integer `units` + fractional `nanos`. */
function moneyToNumber(money: { units?: string | number; nanos?: number }): number {
  return Number(money.units ?? 0) + (money.nanos ?? 0) / 1e9;
}

/** "Shell", "Chevron", "76" — Google's displayName is usually the brand;
 * anything after a separator ("Shell - Capitol Hill") is dropped. */
function brandFromName(name: string): string {
  return name.split(/\s[-–|]\s/)[0].trim();
}

export async function fetchGoogleStations(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<GoogleStation[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.fuelOptions",
    },
    body: JSON.stringify({
      includedTypes: ["gas_station"],
      maxResultCount: 20, // the API's hard maximum per call
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
    fuelOptions?: {
      fuelPrices?: Array<{ type: string; price: { units?: string; nanos?: number }; updateTime?: string }>;
    };
  };

  return ((body.places ?? []) as Place[])
    .filter((p) => p.location)
    .map((p) => {
      const prices: GoogleStation["prices"] = {};
      for (const fp of p.fuelOptions?.fuelPrices ?? []) {
        const grade = GOOGLE_TYPE_TO_GRADE[fp.type];
        if (!grade || !fp.price) continue;
        prices[grade] = { price: moneyToNumber(fp.price), updatedAt: fp.updateTime ?? new Date().toISOString() };
      }
      const name = p.displayName?.text ?? "Gas station";
      return {
        placeId: p.id,
        name,
        brand: brandFromName(name),
        address: p.formattedAddress ?? null,
        latitude: p.location!.latitude,
        longitude: p.location!.longitude,
        prices,
      };
    });
}
