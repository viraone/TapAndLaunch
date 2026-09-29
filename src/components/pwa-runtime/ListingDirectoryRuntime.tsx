"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { RuntimeListing } from "@/lib/pwa/listings";
import { normalizeOpenMicRecord, type OpenMic } from "@/lib/listings/record";
import { buildOpenMicDay, type OpenMicTypeFilter } from "@/lib/listings/day";
import type { TravelEstimate } from "@/lib/listings/travel";
import { ListingDirectoryView, type DistanceState } from "@/components/pwa-runtime/ListingDirectoryView";
import { SignupDetailsModal } from "@/components/pwa-runtime/SignupDetailsModal";
import { TripIntelModal } from "@/components/pwa-runtime/TripIntelModal";

function subscribeToClock(onTick: () => void) {
  const timer = window.setInterval(onTick, 10_000);
  return () => window.clearInterval(timer);
}

/** The current minute, so React re-renders only when the minute changes. */
function getCurrentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/** The server has no "now" for the viewer: it renders the loading line. */
function getServerMinute(): null {
  return null;
}

/** Reads the clock only in the browser, so the server and the browser never
 * disagree about what "today" is, and keeps checking so the Next Open Mic
 * badge moves on as the night goes. Holds what the viewer chose: the day, the
 * type, the highlighted mic, Show Distance, and an open window. */
export function ListingDirectoryRuntime({ listings }: { listings: RuntimeListing[] }) {
  const minute = useSyncExternalStore(subscribeToClock, getCurrentMinute, getServerMinute);
  const mics = useMemo(
    () =>
      listings
        .map((listing) => normalizeOpenMicRecord(listing.record))
        .filter((mic): mic is OpenMic => mic !== null),
    [listings]
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<OpenMicTypeFilter>("all");
  // A tapped mic stays highlighted until the day, the type or the next mic
  // changes; then the highlight goes back to the next mic, as on StageTime.
  const [chosen, setChosen] = useState<{ key: string; id: string } | null>(null);
  const [signupMic, setSignupMic] = useState<OpenMic | null>(null);
  const [distance, setDistance] = useState<DistanceState>({ state: "off" });
  const [trip, setTrip] = useState<{ mic: OpenMic; travelEstimate: TravelEstimate } | null>(null);

  if (minute === null) {
    return <p className="text-sm text-muted-foreground">Loading today&apos;s open mics…</p>;
  }

  const userLocation = distance.state === "on" ? distance.location : null;
  const day = buildOpenMicDay(mics, new Date(minute * 60_000), selectedDay, selectedType, userLocation);
  const key = `${day.dayName}|${selectedType}|${day.nextMic?.id ?? ""}`;
  const activeId = chosen?.key === key ? chosen.id : (day.nextMic?.id ?? null);

  function selectMic(id: string, scroll: boolean) {
    setChosen({ key, id });
    if (!scroll) return;
    // Once the highlight's 150ms colour transition has run: Safari drops a
    // smooth scroll that starts while Tailwind 4's transitions are running.
    window.setTimeout(() => {
      const card = document.getElementById(`open-mic-card-${id}`);
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      card?.focus({ preventScroll: true });
    }, 160);
  }

  // Show Distance asks the browser once; a second press turns it off.
  function toggleDistance() {
    if (distance.state === "on") {
      setDistance({ state: "off" });
      return;
    }
    if (!navigator.geolocation) {
      setDistance({ state: "unsupported" });
      return;
    }
    setDistance({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setDistance({
          state: "on",
          location: { latitude: position.coords.latitude, longitude: position.coords.longitude },
        }),
      () => setDistance({ state: "denied" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <>
      <ListingDirectoryView
        day={day}
        selectedType={selectedType}
        activeId={activeId}
        onSelectDay={setSelectedDay}
        onSelectType={setSelectedType}
        onSelectMic={selectMic}
        onShowSignupDetails={setSignupMic}
        distance={distance}
        onToggleDistance={toggleDistance}
        onOpenTrip={(mic, travelEstimate) => setTrip({ mic, travelEstimate })}
      />
      {signupMic && <SignupDetailsModal mic={signupMic} onClose={() => setSignupMic(null)} />}
      {trip && userLocation && (
        <TripIntelModal
          mic={trip.mic}
          travelEstimate={trip.travelEstimate}
          userLocation={userLocation}
          selectedDate={day.selectedDate}
          onClose={() => setTrip(null)}
        />
      )}
    </>
  );
}
