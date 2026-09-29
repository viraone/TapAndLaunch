import type { OpenMic } from "./record";
import { calculateHaversineMiles, summarizeNearbyParking } from "./travel";

// The live services StageTime's trip panel asks (app.js on stagetimepnw.com).
// Browser only: OneBusAway is reached by JSONP, as StageTime does it.

export type CurrentWeather = {
  temperature_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
};

const weatherCache = new Map<string, Promise<CurrentWeather>>();

async function fetchWeather(mic: Pick<OpenMic, "latitude" | "longitude">): Promise<CurrentWeather> {
  const params = new URLSearchParams({
    latitude: String(mic.latitude),
    longitude: String(mic.longitude),
    current: "temperature_2m,apparent_temperature,precipitation,weather_code",
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`Weather request failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.current) throw new Error("Weather response did not include current conditions");
  return payload.current as CurrentWeather;
}

/** Current weather at a venue from Open-Meteo, one request per place. */
export function getCachedWeather(mic: Pick<OpenMic, "latitude" | "longitude">): Promise<CurrentWeather> {
  const cacheKey = `${mic.latitude},${mic.longitude}`;
  let request = weatherCache.get(cacheKey);
  if (!request) {
    request = fetchWeather(mic).catch((error) => {
      weatherCache.delete(cacheKey);
      throw error;
    });
    weatherCache.set(cacheKey, request);
  }
  return request;
}

/** Parking mapped in OpenStreetMap within 300 m of a venue. */
export async function fetchParking(
  mic: Pick<OpenMic, "latitude" | "longitude">
): Promise<{ summary: string; huntMinutes: number }> {
  const query = `[out:json][timeout:8];nwr["amenity"="parking"](around:300,${mic.latitude},${mic.longitude});out tags center;`;
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Parking request failed: HTTP ${response.status}`);
  const payload = await response.json();
  return summarizeNearbyParking(payload.elements);
}

// StageTime's own OneBusAway key, as its app.js ships it.
const OBA_API_KEY = "ceb473d5-b12a-4833-82da-c4c721a62f17";
const OBA_BASE_URL = "https://api.pugetsound.onebusaway.org/api/where";

export type TransitRoute = {
  routeShortName: string;
  headsign: string;
  minutesUntil: number;
  walkMinutes: number;
  stopName: string;
  isRealTime: boolean;
};

export type TransitResult = { error: string } | { stopsFound: number; nearestStop?: string; routes: TransitRoute[] };

type ObaStop = { id: string; name: string; lat: number; lon: number; direction?: string };
type ObaArrival = {
  routeShortName?: string;
  routeId?: string;
  tripHeadsign?: string;
  predictedArrivalTime?: number;
  scheduledArrivalTime?: number;
  predictedDepartureTime?: number;
  scheduledDepartureTime?: number;
};

const transitCache = new Map<string, { timestamp: number; data: TransitResult }>();

function fetchOneBusAwayJsonp<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackName = `oba_cb_${Math.random().toString(36).substring(2, 10)}`;
    const script = document.createElement("script");
    const callbacks = window as unknown as Record<string, unknown>;
    let timedOut = false;
    const cleanup = () => {
      script.remove();
      delete callbacks[callbackName];
      clearTimeout(timeout);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      cleanup();
      reject(new Error("OneBusAway request timed out"));
    }, 6000);
    callbacks[callbackName] = (data: T) => {
      if (timedOut) return;
      cleanup();
      resolve(data);
    };
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("OneBusAway API rate-limited or unavailable"));
    };
    document.head.appendChild(script);
  });
}

/** Buses leaving within 90 minutes from the two stops nearest the viewer,
 * one per route, soonest first. */
export async function fetchOneBusAwayTransit(originLat: number, originLon: number): Promise<TransitResult> {
  const cacheKey = `${originLat.toFixed(3)},${originLon.toFixed(3)}`;
  const nowMs = Date.now();
  const cached = transitCache.get(cacheKey);
  if (cached && nowMs - cached.timestamp < 60000) return cached.data;

  try {
    const stopsData = await fetchOneBusAwayJsonp<{ data?: { list?: ObaStop[] } }>(
      `${OBA_BASE_URL}/stops-for-location.json?key=${OBA_API_KEY}&lat=${originLat}&lon=${originLon}&radius=800`
    );
    const stops = stopsData?.data?.list || [];
    if (!stops.length) return { error: "No Puget Sound transit stops within a 10-minute walk." };

    stops.sort(
      (a, b) =>
        calculateHaversineMiles(originLat, originLon, a.lat, a.lon) - calculateHaversineMiles(originLat, originLon, b.lat, b.lon)
    );
    // Only the nearest one or two stops, to stay under the rate limit.
    const primaryStops = stops.slice(0, 2);
    const upcomingRoutes: TransitRoute[] = [];

    for (const stop of primaryStops) {
      try {
        const arrData = await fetchOneBusAwayJsonp<{ data?: { entry?: { arrivalsAndDepartures?: ObaArrival[] } } }>(
          `${OBA_BASE_URL}/arrivals-and-departures-for-stop/${encodeURIComponent(stop.id)}.json?key=${OBA_API_KEY}&minutesBefore=0&minutesAfter=75`
        );
        const arrivals = arrData?.data?.entry?.arrivalsAndDepartures || [];
        const stopDistMiles = calculateHaversineMiles(originLat, originLon, stop.lat, stop.lon);
        const walkMinutes = Math.max(1, Math.round((stopDistMiles / 3.0) * 60));
        for (const arr of arrivals) {
          const targetTime =
            arr.predictedArrivalTime || arr.scheduledArrivalTime || arr.predictedDepartureTime || arr.scheduledDepartureTime || 0;
          const minutesUntil = Math.round((targetTime - nowMs) / 60000);
          if (minutesUntil >= 0 && minutesUntil <= 90) {
            upcomingRoutes.push({
              routeShortName: String(arr.routeShortName || arr.routeId || ""),
              headsign: String(arr.tripHeadsign || stop.direction || "Inbound"),
              minutesUntil,
              walkMinutes,
              stopName: String(stop.name),
              isRealTime: Boolean(arr.predictedArrivalTime || arr.predictedDepartureTime),
            });
          }
        }
      } catch {
        // One stop failing still leaves the other.
      }
    }

    upcomingRoutes.sort((a, b) => a.minutesUntil - b.minutesUntil);
    const seenRoutes = new Set<string>();
    const routes = upcomingRoutes.filter((item) => {
      const routeKey = item.routeShortName.trim().toLowerCase();
      if (!routeKey || seenRoutes.has(routeKey)) return false;
      seenRoutes.add(routeKey);
      return true;
    });

    const result: TransitResult = { stopsFound: stops.length, nearestStop: primaryStops[0]?.name, routes };
    transitCache.set(cacheKey, { timestamp: nowMs, data: result });
    return result;
  } catch {
    return { error: 'Live transit feed temporarily busy. Tap "Bus Routes" below for full schedule.' };
  }
}
