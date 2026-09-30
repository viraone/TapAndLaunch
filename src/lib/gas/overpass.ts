import "server-only";

/**
 * OpenStreetMap via the Overpass API — the no-key fallback when
 * `GOOGLE_MAPS_API_KEY` isn't configured. Station *locations only*; OSM has
 * no price data, so stations found this way show prices only once a driver
 * submits them. Public, rate-limited, best-effort: a failure here is
 * caught by the caller and treated as "no new stations", never a 500.
 */

export interface OverpassStation {
  osmId: string;
  name: string;
  brand: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
}

export async function fetchOverpassStations(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<OverpassStation[]> {
  const query = `[out:json][timeout:15];nwr["amenity"="fuel"](around:${Math.round(radiusMeters)},${latitude},${longitude});out center 40;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error(`Overpass error (${res.status})`);

  type Element = {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  };
  const body = (await res.json()) as { elements?: Element[] };

  return (body.elements ?? [])
    .map((el): OverpassStation | null => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat === undefined || lon === undefined) return null;
      const tags = el.tags ?? {};
      const brand = tags.brand ?? null;
      const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
      return {
        osmId: `${el.type}/${el.id}`,
        name: tags.name ?? brand ?? "Gas station",
        brand,
        address: street || null,
        latitude: lat,
        longitude: lon,
      };
    })
    .filter((s): s is OverpassStation => s !== null);
}
