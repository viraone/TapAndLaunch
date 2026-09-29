"use client";

import { useEffect, useState } from "react";
import type { OpenMic } from "@/lib/listings/record";
import { getTripTrafficCondition, getWeatherCondition, type TravelEstimate } from "@/lib/listings/travel";
import { getCachedWeather } from "@/lib/listings/trip-services";
import styles from "@/components/pwa-runtime/ListingDirectory.module.css";

/** The distance pill on a card once Show Distance is on (the trip-intel-trigger
 * in StageTime's renderOpenMicCard): miles, drive time and traffic, live
 * temperature at the venue, and the way into the trip window. leading-4 is
 * Tailwind 3's text-xs line height, which the pill's smaller marks inherit. */
export function TripPill({
  mic,
  travelEstimate,
  onOpen,
}: {
  mic: OpenMic;
  travelEstimate: TravelEstimate;
  onOpen: () => void;
}) {
  const traffic = getTripTrafficCondition(travelEstimate.driveMinutes);
  return (
    <button
      type="button"
      className={`${styles.tripTrigger} mt-2.5 inline-flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-full border border-emerald-800/70 bg-zinc-950 px-3 py-2 text-xs leading-4 shadow-[0_0_10px_rgba(34,197,94,0.1)] sm:flex-nowrap`}
      aria-label={`Open trip and venue information for ${mic.venue || mic.name}`}
      onClick={onOpen}
    >
      <span className={styles.liveDot} aria-hidden="true"></span>
      <span className="font-bold text-white">{`${travelEstimate.distanceMiles.toFixed(1)} mi`}</span>
      <span className={styles.pillSeparator} aria-hidden="true">
        •
      </span>
      <span className="whitespace-nowrap text-zinc-200">
        {`🚗 ${travelEstimate.driveMinutes} min (`}
        <span className={`font-bold ${traffic.className}`}>{traffic.label}</span>)
      </span>
      <span className={styles.pillSeparator} aria-hidden="true">
        •
      </span>
      <PillWeather mic={mic} />
      <span className="hidden text-zinc-600 sm:inline" aria-hidden="true">
        |
      </span>
      <span className={styles.pillCta}>
        🚗 Directions &amp; Transit{" "}
        <span className={styles.pillArrow} aria-hidden="true">
          ↗
        </span>
      </span>
    </button>
  );
}

function PillWeather({ mic }: { mic: OpenMic }) {
  const [label, setLabel] = useState<{ text: string; spoken: string }>({
    text: "🌡️ --°F",
    spoken: "Loading live weather",
  });
  useEffect(() => {
    let current = true;
    getCachedWeather(mic).then(
      (weather) => {
        if (!current) return;
        const condition = getWeatherCondition(weather.weather_code);
        const degrees = Math.round(weather.temperature_2m);
        setLabel({ text: `${condition.emoji} ${degrees}°F`, spoken: `${condition.label}, ${degrees} degrees Fahrenheit` });
      },
      () => current && setLabel({ text: "🌡️ Weather unavailable", spoken: "Live weather unavailable" })
    );
    return () => {
      current = false;
    };
  }, [mic]);
  return (
    <span className="whitespace-nowrap font-semibold text-zinc-200" aria-label={label.spoken}>
      {label.text}
    </span>
  );
}
