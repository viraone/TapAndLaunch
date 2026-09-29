"use client";

import { useEffect, useRef, useState } from "react";
import type { OpenMic } from "@/lib/listings/record";
import {
  buildTripReminder,
  getWeatherCondition,
  TRIP_DEFAULT_PARKING_HUNT_MINUTES,
  TRIP_PARKING_FALLBACK,
  TRIP_SIGNUP_FALLBACK,
  type LatLng,
  type TravelEstimate,
} from "@/lib/listings/travel";
import {
  fetchOneBusAwayTransit,
  fetchParking,
  getCachedWeather,
  type CurrentWeather,
  type TransitResult,
} from "@/lib/listings/trip-services";
import { SheetModal } from "@/components/pwa-runtime/SheetModal";
import styles from "@/components/pwa-runtime/ListingDirectory.module.css";

type Loaded<T> = { state: "loading" } | { state: "done"; value: T } | { state: "failed" };

/** StageTime's "Trip & Venue Intel" window (tripIntelModal in its index.html,
 * openTripIntelModal in its app.js): drive, parking and bus estimates, live
 * departures, weather and parking near the venue, map links, and a calendar
 * reminder to leave. */
export function TripIntelModal({
  mic,
  travelEstimate,
  userLocation,
  selectedDate,
  onClose,
}: {
  mic: OpenMic;
  travelEstimate: TravelEstimate;
  userLocation: LatLng;
  /** The selected day, for the reminder's date. */
  selectedDate: Date;
  onClose: () => void;
}) {
  const venueName = mic.venue || mic.name;
  const defaultParkingHunt = mic.parkingHuntMinutes ?? TRIP_DEFAULT_PARKING_HUNT_MINUTES;
  const [weather, setWeather] = useState<Loaded<CurrentWeather>>({ state: "loading" });
  const [parking, setParking] = useState<Loaded<{ summary: string; huntMinutes: number }>>({ state: "loading" });
  const [transit, setTransit] = useState<TransitResult | null>(null);
  const [feedback, setFeedback] = useState("");
  const transitSection = useRef<HTMLElement>(null);
  const [transitRing, setTransitRing] = useState(false);

  useEffect(() => {
    let current = true;
    getCachedWeather(mic).then(
      (value) => current && setWeather({ state: "done", value }),
      () => current && setWeather({ state: "failed" })
    );
    fetchParking(mic).then(
      (value) => current && setParking({ state: "done", value }),
      () => current && setParking({ state: "failed" })
    );
    fetchOneBusAwayTransit(userLocation.latitude, userLocation.longitude).then((value) => current && setTransit(value));
    return () => {
      current = false;
    };
  }, [mic, userLocation]);

  const drive = Math.max(0, Math.round(travelEstimate.driveMinutes));
  const parkingHunt =
    parking.state === "done" ? (mic.parkingHuntMinutes ?? parking.value.huntMinutes) : defaultParkingHunt;
  const total = drive + parkingHunt;
  const destination = encodeURIComponent(mic.address);

  function setAlarm() {
    const reminder = buildTripReminder(mic, total, selectedDate, new Date());
    if (!reminder) {
      setFeedback("A sign-up or start time is needed to set this reminder.");
      return;
    }
    const url = URL.createObjectURL(new Blob([reminder.ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = reminder.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback(`Calendar reminder created for ${reminder.leaveAtLabel}.`);
  }

  function showTransit() {
    transitSection.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTransitRing(true);
    window.setTimeout(() => setTransitRing(false), 1500);
  }

  return (
    <SheetModal
      eyebrow={venueName}
      title={{ visible: "Trip & Venue Intel", spoken: "Trip and venue information" }}
      closeLabel="Close trip and venue information"
      describedBy="tripIntelRoute"
      onClose={onClose}
      footer={
        <>
          <footer className={styles.actions}>
            <a
              className={`${styles.action} ${styles.actionTransit}`}
              href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destination}&travelmode=transit`}
              target="_blank"
              rel="noopener noreferrer"
            >
              🚌 Bus Routes
            </a>
            <a className={styles.action} href={`https://maps.apple.com/?daddr=${destination}`} target="_blank" rel="noopener noreferrer">
              🗺️ Apple Maps
            </a>
            <a
              className={styles.action}
              href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              📍 Google Maps
            </a>
            <button type="button" className={`${styles.action} ${styles.actionPrimary}`} onClick={setAlarm}>
              🔔 Set Alarm
            </button>
          </footer>
          <p className={styles.feedback} role="status" aria-live="polite">
            {feedback}
          </p>
        </>
      }
    >
      <section className={styles.modalSection} aria-label="Commute and travel time">
        <h3 className={styles.sectionTitle}>🚦 Commute &amp; Travel Time</h3>
        <p id="tripIntelRoute" className={styles.route}>
          {`Current location ➜ ${venueName} (${travelEstimate.distanceMiles.toFixed(1)} mi)`}
        </p>
        <div className={styles.metrics}>
          <div>
            <span className={styles.metricLabel}>🚗 Drive</span>
            <strong>{`${drive} min`}</strong>
          </div>
          <div>
            <span className={styles.metricLabel}>🅿️ Parking hunt</span>
            <strong>{`+${parkingHunt} min`}</strong>
          </div>
          <button
            type="button"
            onClick={showTransit}
            className="flex flex-col text-left transition [&:hover]:border-blue-500/60 [&:hover]:bg-blue-950/20 group"
          >
            <span className={`${styles.metricLabel} flex items-center justify-between w-full`}>
              <span>🚌 Bus / Transit</span>
              <span className="text-[9px] text-blue-400 [.group:hover_&]:underline">View live ↓</span>
            </span>
            <strong className="text-blue-300">
              {travelEstimate.transitMinutes ? `~${travelEstimate.transitMinutes} min` : "—"}
            </strong>
          </button>
          <div className={styles.metricTotal}>
            <span className={styles.metricLabel}>Total Drive</span>
            <strong>{`${total} min`}</strong>
          </div>
        </div>
      </section>

      <section
        ref={transitSection}
        id="tripIntelTransitSection"
        className={`${styles.modalSection} border-blue-900/40 bg-zinc-900/90 ${transitRing ? "ring-2 ring-blue-500" : ""}`}
        aria-label="Live Puget Sound transit"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={`${styles.sectionTitle} text-blue-400 m-0`}>🚌 Live Puget Sound Transit Intel</h3>
          <span className="rounded-full bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-800/60">
            King County Metro / Sound Transit
          </span>
        </div>
        {/* leading-5: Tailwind 3's text-sm line height, which the smaller text inside inherits on StageTime. */}
        <div className="space-y-2 text-sm leading-5">
          {transit === null ? (
            <p className={styles.loading}>Locating nearest bus lines &amp; live departures…</p>
          ) : "error" in transit || !transit.routes.length ? (
            <div className="rounded-[8px] bg-zinc-950 p-3 border border-zinc-800 text-zinc-400">
              <p className="font-medium text-xs">
                {"error" in transit ? transit.error : "No active bus departures found right now."}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Use the &quot;Bus Routes&quot; button below for full schedule &amp; transfer steps.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {transit.routes.map((r) => (
                <div
                  key={r.routeShortName}
                  className="flex items-center justify-between rounded-[8px] border border-zinc-800 bg-zinc-950/80 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-[4px] bg-blue-600 px-2 py-0.5 text-xs font-black text-white">
                        {`Route ${r.routeShortName}`}
                      </span>
                      <span className="truncate text-xs font-bold text-zinc-200">{r.headsign}</span>
                      {r.isRealTime && <span className="text-[10px] text-emerald-400 font-bold">● Live</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Board at <span className="text-zinc-200 font-medium">{r.stopName}</span>
                      {` (🚶 ~${r.walkMinutes} min walk)`}
                    </p>
                  </div>
                  <div className="text-right pl-3">
                    <span className={`text-sm font-black ${r.minutesUntil <= 5 ? "text-amber-400" : "text-blue-300"}`}>
                      {`in ${r.minutesUntil} min`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.modalSection} aria-label="Local weather">
        <h3 className={styles.sectionTitle}>🌦️ Local Weather</h3>
        {weather.state === "done" ? (
          <div className={styles.weatherLine} role="status">
            <WeatherLine weather={weather.value} />
          </div>
        ) : (
          <div className={styles.loading} role="status">
            {weather.state === "loading" ? "Loading live conditions…" : "Live weather is temporarily unavailable."}
          </div>
        )}
      </section>

      <section className={styles.modalSection} aria-label="Parking and venue access">
        <h3 className={styles.sectionTitle}>🅿️ Parking &amp; Venue Access</h3>
        <dl className={styles.accessList}>
          <div>
            <dt>Parking</dt>
            <dd role="status">
              {parking.state === "done"
                ? parking.value.summary
                : parking.state === "loading"
                  ? "Checking nearby parking…"
                  : TRIP_PARKING_FALLBACK}
            </dd>
          </div>
          <div>
            <dt>Sign-up location</dt>
            <dd>{mic.signupLocationNote || TRIP_SIGNUP_FALLBACK}</dd>
          </div>
        </dl>
      </section>
    </SheetModal>
  );
}

function WeatherLine({ weather }: { weather: CurrentWeather }) {
  const condition = getWeatherCondition(weather.weather_code);
  const precipitation =
    Number(weather.precipitation) > 0
      ? `${Number(weather.precipitation).toFixed(2)} in precipitation`
      : "No current precipitation";
  return (
    <>
      <span>
        {`${condition.emoji} `}
        <strong>{`${Math.round(weather.temperature_2m)}°F`}</strong>
        {` (feels ${Math.round(weather.apparent_temperature)}°)`}
      </span>
      <span>{`${condition.label} · ${precipitation}`}</span>
    </>
  );
}
