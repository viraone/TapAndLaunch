/**
 * The pure rules behind automatic reminders. No database, no network: the sender
 * (sender.ts) reads the rows, then asks these functions what to do.
 */

/** Never send for a visit that starts sooner than this; there is no point in reminding someone 10 minutes ahead. */
export const MIN_LEAD_MINUTES = 30;

/** A failed send gets at most this many attempts in total. */
export const MAX_ATTEMPTS = 3;

/** A row still 'sending' after this long belongs to a run that died; it is marked failed and never resent. */
export const STALE_SENDING_MINUTES = 15;

/** At most this many visits are handled by one cron run. */
export const PER_RUN_LIMIT = 40;

/** At most this many visits are handled for one app in one run. */
export const PER_APP_LIMIT = 20;

/** How long to wait before retrying a failed send. */
const RETRY_DELAY_MINUTES = 5;

/**
 * Whether a visit's reminder window is open now.
 *
 * True when the visit is still more than MIN_LEAD_MINUTES away AND the moment
 * `hoursBefore` hours before it has already arrived. A visit booked late, when
 * that moment has already passed but the visit is still far enough ahead, is
 * due immediately (once).
 */
export function isDue(input: {
  startsAt: Date;
  hoursBefore: number;
  now: Date;
}): boolean {
  const startMs = input.startsAt.getTime();
  const nowMs = input.now.getTime();

  if (startMs <= nowMs + MIN_LEAD_MINUTES * 60_000) return false;

  const windowOpensMs = startMs - input.hoursBefore * 60 * 60_000;
  return windowOpensMs <= nowMs;
}

/**
 * Whether a failed Gmail send is worth retrying. A network failure (0), a
 * permission/rate answer (403/429) and any server error (5xx) are retryable;
 * a bad request, a broken grant or a missing message are not.
 */
export function isRetryableSendFailure(status: number): boolean {
  return status === 0 || status === 403 || status === 429 || (status >= 500 && status <= 599);
}

export type ReminderLogStatus = "sending" | "sent" | "failed" | "skipped";

export interface ExistingReminder {
  status: ReminderLogStatus;
  attempts: number;
  updatedAt: Date;
}

/**
 * What to do with a visit that already has a log row.
 *
 * A stale `sending` row is not retried here: claimAction always leaves it alone.
 * The sender is the one that marks it failed as 'interrupted', so a duplicate
 * email can never go out.
 */
export function claimAction(
  existing: ExistingReminder | null,
  now: Date
): "claim_new" | "retry" | "leave" {
  if (!existing) return "claim_new";
  if (existing.status === "sent" || existing.status === "skipped") return "leave";
  if (existing.status === "sending") return "leave";
  if (existing.attempts >= MAX_ATTEMPTS) return "leave";
  if (existing.updatedAt.getTime() + RETRY_DELAY_MINUTES * 60_000 > now.getTime()) return "leave";
  return "retry";
}

/** The short code written to reminder_log for a failed send. */
export function errorCodeForSend(status: number): "rate_limited" | "send_failed" {
  return status === 403 || status === 429 ? "rate_limited" : "send_failed";
}
