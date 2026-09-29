import type { OpenMic } from "@/lib/listings/record";
import type { OpenMicDay, OpenMicTypeFilter } from "@/lib/listings/day";
import { formatMinutesToClock } from "@/lib/listings/format";
import { getOpenMicTravelEstimate, type LatLng, type TravelEstimate } from "@/lib/listings/travel";
import { ListingCard } from "@/components/pwa-runtime/ListingCard";

const DAY_BUTTONS = [
  ["Sunday", "Sun"],
  ["Monday", "Mon"],
  ["Tuesday", "Tue"],
  ["Wednesday", "Wed"],
  ["Thursday", "Thu"],
  ["Friday", "Fri"],
  ["Saturday", "Sat"],
] as const;

const TYPE_BUTTONS: ReadonlyArray<readonly [OpenMicTypeFilter, string]> = [
  ["all", "All"],
  ["comedy", "Comedy"],
  ["variety", "Music & Variety"],
];

// StageTime's day buttons keep font-bold when chosen (it wins over the
// font-black added then); its type buttons swap to font-black.
const SELECTED_DAY = "border-[#00C805] bg-[#00C805] text-black font-bold";
const SELECTED_PILL = "border-[#00C805] bg-[#00C805] text-black font-black";
const UNSELECTED_PILL = "border-zinc-700 bg-transparent text-zinc-400 font-bold";

/** Where Show Distance is: off, asking the browser, on, or refused. */
export type DistanceState =
  | { state: "off" }
  | { state: "locating" }
  | { state: "on"; location: LatLng }
  | { state: "denied" }
  | { state: "unsupported" };

const DISTANCE_BUTTON_TEXT: Record<DistanceState["state"], string> = {
  off: "Show Distance",
  locating: "Locating…",
  on: "Disable Distance",
  denied: "Show Distance",
  unsupported: "Show Distance",
};

const DISTANCE_STATUS_TEXT: Record<DistanceState["state"], string> = {
  off: "Turn on location to see distance and drive times.",
  locating: "Requesting location permissions…",
  on: "Showing distances from your current location.",
  denied: "Location access denied or unavailable.",
  unsupported: "Geolocation is not supported by your browser.",
};

function micSummary(mic: OpenMic | null): string {
  return mic ? `${formatMinutesToClock(mic.startMinutes) || "Time TBD"} · ${mic.name}` : "—";
}

/** A Listing directory's open mics for one day, as StageTime's open mic view
 * shows them (index.html's openmicmap-section and renderOpenMicMapView in its
 * app.js): the header with the day and type buttons, the cards, and the
 * selected day's summary. Everything it shows comes from `day`, so it can be
 * tested at a fixed time; ListingDirectoryRuntime holds the choices. */
export function ListingDirectoryView({
  day,
  selectedType,
  activeId,
  distance = { state: "off" },
  onSelectDay,
  onSelectType,
  onSelectMic,
  onShowSignupDetails,
  onToggleDistance,
  onOpenTrip,
}: {
  day: OpenMicDay;
  selectedType: OpenMicTypeFilter;
  activeId: string | null;
  distance?: DistanceState;
  onSelectDay?: (dayName: string) => void;
  onSelectType?: (type: OpenMicTypeFilter) => void;
  /** A card or a summary line was chosen; `scroll` when the card should come into view. */
  onSelectMic?: (id: string, scroll: boolean) => void;
  onShowSignupDetails?: (mic: OpenMic) => void;
  onToggleDistance?: () => void;
  onOpenTrip?: (mic: OpenMic, travelEstimate: TravelEstimate) => void;
}) {
  const userLocation = distance.state === "on" ? distance.location : null;
  return (
    // py-5 on top of the block's own py-3 gives StageTime's 32px page margin.
    <section aria-labelledby="openmicmap-title" className="min-w-0 py-5">
      <header className="mb-5 rounded-[16px] border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#00C805]">Open Mics Today</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 id="openmicmap-title" className="text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">
                <span>{day.dayName}</span>
              </h1>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{day.dateLabel}</p>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={onToggleDistance}
              className="group w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-full bg-[#00C805] px-4 py-2 text-xs font-black text-black shadow-[0_0_20px_rgba(0,200,5,0.45)] transition-all duration-200 [&:hover]:scale-105 [&:hover]:bg-[#00E006] [&:hover]:shadow-[0_0_28px_rgba(0,200,5,0.7)] active:scale-95 focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className="h-3.5 w-3.5 text-black stroke-[2.5] transition [.group:hover_&]:rotate-90"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="22" y1="12" x2="18" y2="12"></line>
                <line x1="6" y1="12" x2="2" y2="12"></line>
                <line x1="12" y1="6" x2="12" y2="2"></line>
                <line x1="12" y1="22" x2="12" y2="18"></line>
              </svg>
              <span className="tracking-tight">{DISTANCE_BUTTON_TEXT[distance.state]}</span>
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-2" role="group" aria-label="Choose a day">
            {DAY_BUTTONS.map(([dayName, label]) => {
              const isSelected = dayName === day.dayName;
              return (
                <button
                  key={dayName}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectDay?.(dayName)}
                  className={`rounded-[8px] border px-1.5 py-2 text-xs text-center transition [&:hover]:border-[#00C805]/50 [&:hover]:text-zinc-200 ${
                    isSelected ? SELECTED_DAY : UNSELECTED_PILL
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5 sm:gap-2" role="group" aria-label="Filter by open mic type">
            {TYPE_BUTTONS.map(([type, label]) => {
              const isSelected = type === selectedType;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectType?.(type)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    type === "all" ? "" : "[&:hover]:border-[#00C805]/50 [&:hover]:text-zinc-200"
                  } ${isSelected ? SELECTED_PILL : UNSELECTED_PILL}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-t border-zinc-800/60 pt-2.5">
          <p className="text-xs text-zinc-400 leading-normal" role="status" aria-live="polite">
            {DISTANCE_STATUS_TEXT[distance.state]}
          </p>
          <p className="text-[10px] text-zinc-600">
            Distance coordinates ©{" "}
            <a
              className="underline [&:hover]:text-zinc-400"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenStreetMap contributors
            </a>
          </p>
        </div>
      </header>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0">
          {day.status && (
            <p
              role="status"
              aria-live="polite"
              className="mb-4 rounded-[8px] border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300"
            >
              {day.status}
            </p>
          )}
          <div className="space-y-3">
            {day.cards.map(({ mic, upcomingDate, isNext }) => (
              <ListingCard
                key={`${mic.id}-${upcomingDate ? "preview" : "on"}`}
                mic={mic}
                isNext={isNext}
                isActive={!upcomingDate && mic.id === activeId}
                isToday={day.isToday}
                selectedDate={day.selectedDate}
                upcomingDate={upcomingDate}
                travelEstimate={getOpenMicTravelEstimate(mic, userLocation)}
                onSelect={(id) => onSelectMic?.(id, false)}
                onShowSignupDetails={onShowSignupDetails}
                onOpenTrip={onOpenTrip}
              />
            ))}
          </div>
        </div>

        <aside
          className="min-w-0 rounded-[16px] border border-zinc-800 bg-zinc-900/40 p-4 xl:sticky xl:top-5 xl:self-start"
          aria-labelledby="openMicTonightTitle"
        >
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">Selected day</p>
              <h2 id="openMicTonightTitle" className="mt-0.5 text-base font-black text-zinc-100">
                {`${day.dayName}'s Mics`}
              </h2>
            </div>
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm font-bold text-zinc-300">
              {`${day.todays.length} ${day.todays.length === 1 ? "open mic" : "open mics"}`}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-2 border-b border-zinc-800 py-3">
            <div className="rounded-[8px] bg-zinc-950/80 p-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Next</dt>
              <dd className="mt-1 text-sm font-bold text-zinc-200">{micSummary(day.nextMic)}</dd>
            </div>
            <div className="rounded-[8px] bg-zinc-950/80 p-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Last</dt>
              <dd className="mt-1 text-sm font-bold text-zinc-200">{micSummary(day.lastMic)}</dd>
            </div>
          </dl>

          <div className="mt-2 space-y-1">
            {day.todays.map((mic) => {
              const isActive = mic.id === activeId;
              return (
                <button
                  key={mic.id}
                  type="button"
                  onClick={() => onSelectMic?.(mic.id, true)}
                  className="group flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left transition [&:hover]:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#00C805]"
                >
                  <span className={`w-16 shrink-0 text-xs font-black ${isActive ? "text-[#00C805]" : "text-zinc-500"}`}>
                    {formatMinutesToClock(mic.startMinutes) || "TBD"}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-sm font-semibold ${
                      isActive ? "text-white font-bold" : "text-zinc-300"
                    } [.group:hover_&]:text-white`}
                  >
                    {mic.name}
                  </span>
                  <span
                    className="text-zinc-700 transition [.group:hover_&]:translate-x-0.5 [.group:hover_&]:text-[#00C805]"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}
