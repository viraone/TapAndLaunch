import type { ReactNode } from "react";
import { getOpenMicHost, type OpenMic } from "@/lib/listings/record";
import { buildOpenMicListButtonLabel, buildOpenMicTimeLabel, formatMinutesToClock } from "@/lib/listings/format";
import { formatUpcomingOpenMicDate } from "@/lib/listings/recurrence";
import { getSeattleNow } from "@/lib/listings/time";
import styles from "@/components/pwa-runtime/ListingDirectory.module.css";

// StageTime's classes, as its app.js writes them. Hover styles are written
// [&:hover]: rather than hover: so they apply on phones too, as they do on
// StageTime (Tailwind 3), where a tapped button keeps its hover look.

// Card actions run at a 44px touch target, with the accent in the resting
// state: a phone never fires :hover.
const MIC_ACTION_BUTTON_CLASS =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[6px] " +
  "border border-[#00C805]/50 bg-[#00C805]/10 px-4 py-2.5 text-[13px] font-semibold " +
  "text-[#00C805] transition [&:hover]:border-[#00C805] [&:hover]:bg-[#00C805]/20 " +
  "active:bg-[#00C805]/30 active:translate-y-px";

// One kind of action opens a window on this page, the other leaves for a site
// or the dialer; the mark says which. U+FE0E keeps them as text, not emoji.
const MIC_ACTION_MARK_MODAL = "ⓘ";
const MIC_ACTION_MARK_EXTERNAL = "↗︎";
const MIC_ACTION_MARK_PHONE = "☎︎";

const HOST_BADGE_CLASS =
  "inline-flex items-center gap-1.5 rounded-[6px] border border-amber-400/80 bg-gradient-to-r from-amber-500/25 to-amber-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.35)] transition [&:hover]:border-amber-300 [&:hover]:text-amber-100 [&:hover]:shadow-[0_0_16px_rgba(251,191,36,0.5)]";

function ActionContent({ label, leading, trailing }: { label: string; leading?: string; trailing?: string }) {
  return (
    <>
      {leading && <span aria-hidden="true">{leading}</span>}
      <span>{label}</span>
      {trailing && (
        <span aria-hidden="true" className="text-[#00C805]/70">
          {trailing}
        </span>
      )}
    </>
  );
}

function HostBadgeContent({ host }: { host: string }) {
  return (
    <>
      <span aria-hidden="true">🎤</span>
      <span className="text-amber-400/90 font-bold normal-case tracking-normal">Host:</span>
      <span className="normal-case tracking-normal text-white">{host}</span>
    </>
  );
}

/** One open mic in a published Listing directory, as StageTime draws it
 * (renderOpenMicCard in its app.js). With `upcomingDate` it is a locked
 * preview: a mic whose schedule skips the selected day, with its next date.
 * The distance and drive-time pill arrives with Show Distance. */
export function ListingCard({
  mic,
  isNext,
  isActive = false,
  isToday,
  selectedDate,
  upcomingDate = null,
  onSelect,
  onShowSignupDetails,
}: {
  mic: OpenMic;
  isNext: boolean;
  /** The highlighted card: the next mic until another card is tapped. */
  isActive?: boolean;
  isToday: boolean;
  /** The selected day, for its name and that day's host. */
  selectedDate: Date;
  upcomingDate?: Date | null;
  onSelect?: (id: string) => void;
  onShowSignupDetails?: (mic: OpenMic) => void;
}) {
  const isLockedPreview = upcomingDate !== null;
  const selectedDayName = getSeattleNow(selectedDate).dayName;

  const className = isLockedPreview
    ? "relative rounded-[12px] border border-dashed border-zinc-600 bg-zinc-900/40 p-4 opacity-90 transition [&:hover]:opacity-100"
    : `relative cursor-pointer rounded-[12px] border border-zinc-800 bg-zinc-900/45 p-4 transition [&:hover]:border-zinc-700 [&:hover]:bg-zinc-900/70 ${
        isActive ? styles.cardActive : ""
      }`;

  const isNonWeeklyRecurring = Boolean(mic.recurrence && mic.recurrence.type !== "weekly");
  const venueIsRedundant = Boolean(mic.venue) && mic.name.toLowerCase().includes(mic.venue.toLowerCase());
  const hasMeta = Boolean(mic.micType || mic.price || mic.ageRequirement);
  const isCoreType = /comedy|music|variety|anything is allowed/i.test(mic.micType);

  const cardHost = getOpenMicHost(mic, upcomingDate ?? selectedDate);
  // When a list link exists the host is shown on that button instead of as a line.
  const hostOnListButton = Boolean(cardHost && mic.listUrl);
  const hasActions = Boolean(mic.address || mic.website || mic.signupDetails || mic.contact || mic.listUrl);

  const actions: ReactNode[] = [];
  if (mic.website) {
    actions.push(
      <a key="website" href={mic.website} target="_blank" rel="noopener noreferrer" className={MIC_ACTION_BUTTON_CLASS}>
        <ActionContent
          label={mic.signupType === "online" ? "Online Signup" : "Website / Signup"}
          trailing={MIC_ACTION_MARK_EXTERNAL}
        />
      </a>
    );
  }
  if (mic.signupDetails) {
    actions.push(
      <button
        key="signup"
        type="button"
        aria-haspopup="dialog"
        className={MIC_ACTION_BUTTON_CLASS}
        onClick={() => onShowSignupDetails?.(mic)}
      >
        <ActionContent label="Signup details" leading={MIC_ACTION_MARK_MODAL} />
      </button>
    );
  }
  if (mic.listUrl) {
    actions.push(
      hostOnListButton ? (
        <a
          key="list"
          href={mic.listUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={HOST_BADGE_CLASS}
          title={buildOpenMicListButtonLabel(mic.listLabel)}
        >
          <HostBadgeContent host={cardHost} />
        </a>
      ) : (
        <a key="list" href={mic.listUrl} target="_blank" rel="noopener noreferrer" className={MIC_ACTION_BUTTON_CLASS}>
          <ActionContent label={buildOpenMicListButtonLabel(mic.listLabel)} trailing={MIC_ACTION_MARK_EXTERNAL} />
        </a>
      )
    );
  }
  if (mic.contact) {
    actions.push(
      <a
        key="contact"
        href={mic.contact}
        {...(mic.contactIsLink ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={MIC_ACTION_BUTTON_CLASS}
      >
        <ActionContent
          label={mic.contactLabel}
          {...(mic.contactIsLink ? { trailing: MIC_ACTION_MARK_EXTERNAL } : { leading: MIC_ACTION_MARK_PHONE })}
        />
      </a>
    );
  }

  return (
    // The card is the tap target for choosing a mic, as on StageTime; the
    // Tonight panel's buttons do the same by keyboard.
    <article
      id={`open-mic-card-${mic.id}`}
      tabIndex={-1}
      className={`${styles.card} ${className}`}
      onClick={isLockedPreview ? undefined : () => onSelect?.(mic.id)}
    >
      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-1.5">
        {isLockedPreview && upcomingDate && (
          <>
            <span className="inline-block rounded-[8px] border border-red-500 bg-red-600/30 px-3.5 py-2 text-sm font-black uppercase tracking-wider text-red-200 shadow-sm">
              {isToday ? "Not happening tonight" : `Not happening this ${selectedDayName}`}
            </span>
            <span className="inline-block rounded-[8px] border border-amber-400/70 bg-amber-500/15 px-3.5 py-2 text-sm font-black uppercase tracking-wider text-amber-200 shadow-sm">
              {`Next one: ${formatUpcomingOpenMicDate(upcomingDate)}`}
            </span>
          </>
        )}
        {!isLockedPreview && isNext && (
          <>
            <span className="inline-block rounded-[4px] bg-[#00C805] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
              Next Open Mic
            </span>
            {isToday && (
              <span className="inline-block rounded-[4px] border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                Happening Today
              </span>
            )}
          </>
        )}
        {!isLockedPreview && isNonWeeklyRecurring && (
          <span className="inline-block rounded-[4px] border border-[#00C805]/50 bg-[#00C805]/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#00C805]">
            {isToday ? "✓ Happening tonight!" : `✓ Happening this ${selectedDayName}!`}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <h3 className="min-w-0 text-base font-black leading-tight text-zinc-50 sm:text-lg">{mic.name}</h3>
        <p className={`shrink-0 text-sm font-black ${isNext && !isLockedPreview ? "text-[#00C805]" : "text-zinc-200"}`}>
          {formatMinutesToClock(mic.startMinutes) || "Time TBD"}
        </p>
      </div>

      {mic.venue && !venueIsRedundant && <p className="mt-1 text-sm font-semibold text-zinc-300">{mic.venue}</p>}
      {mic.recurrenceText && (
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#00C805]">{mic.recurrenceText}</p>
      )}
      <p className="mt-1 text-sm font-semibold leading-5 text-zinc-400 sm:text-base">{buildOpenMicTimeLabel(mic)}</p>

      {mic.address && <p className="mt-2 text-base font-medium leading-6 text-zinc-300">{mic.address}</p>}

      {hasMeta && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {mic.micType && (
            <span
              className={
                isCoreType
                  ? "rounded-[6px] border border-red-500 bg-red-950/50 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-red-200 shadow-[0_0_8px_rgba(239,68,68,0.25)]"
                  : "rounded-[6px] border border-red-500/40 bg-red-950/30 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-red-300"
              }
            >
              {mic.micType}
            </span>
          )}
          {mic.price && (
            <span
              className={`rounded-[6px] border border-zinc-700 bg-zinc-900/90 px-2.5 py-1 text-xs font-bold ${
                /free/i.test(mic.price) ? "text-[#00C805]" : "text-zinc-200"
              }`}
            >
              {mic.price}
            </span>
          )}
          {mic.ageRequirement && (
            <span className="rounded-[6px] border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-zinc-400">
              {mic.ageRequirement}
            </span>
          )}
        </div>
      )}

      {mic.notes && (
        <div className="mt-3 rounded-[8px] border border-zinc-800/80 bg-zinc-950/60 p-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Details &amp; Rules</span>
          <p className="text-sm font-semibold leading-relaxed text-zinc-200">{mic.notes}</p>
        </div>
      )}

      {cardHost && !hostOnListButton && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={HOST_BADGE_CLASS}>
            <HostBadgeContent host={cardHost} />
          </span>
        </div>
      )}

      {mic.wheelchairAccessible && (
        <p className="mt-3 text-sm font-medium leading-6 text-zinc-300">Wheelchair accessible</p>
      )}

      {hasActions && <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800/80 pt-3">{actions}</div>}
    </article>
  );
}
