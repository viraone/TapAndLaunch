import type {
  AutomationRecipientRow,
  AutomationReminderRow,
  AutomationSendLogRow,
} from "@/types/database";
import { nextOccurrence, type AutomationRule } from "./schedule";

/**
 * The saved reminder as the Automation screen sees it. Pure: the routes read the rows and hand them here, so the
 * single reminder a save returns and each entry of the list look exactly the same.
 */

export type ReminderRow = Pick<
  AutomationReminderRow,
  | "id"
  | "name"
  | "enabled"
  | "schedule_kind"
  | "weekday"
  | "once_date"
  | "send_time"
  | "time_zone"
  | "subject"
  | "body"
>;

export type RecipientRow = Pick<AutomationRecipientRow, "name" | "email">;

export type SendLogRow = Pick<AutomationSendLogRow, "occurrence_at" | "status">;

/** How many past occurrences the screen lists. */
export const RECENT_OCCURRENCES = 5;

/**
 * How many log rows one reminder's history read may scan. A full occurrence is at most 500 recipients (the screen's
 * cap), so five occurrences always fit; the limit only bounds a reminder whose old rows pile up far beyond that.
 */
export const RECENT_LOG_LIMIT = RECENT_OCCURRENCES * 500;

export function ruleForReminder(row: ReminderRow): AutomationRule {
  return {
    scheduleKind: row.schedule_kind,
    weekday: row.weekday,
    onceDate: row.once_date,
    sendTime: row.send_time,
    timeZone: row.time_zone,
  };
}

export interface ReminderState {
  id: string;
  name: string;
  enabled: boolean;
  schedule_kind: "weekly" | "once";
  weekday: number | null;
  once_date: string | null;
  send_time: string;
  time_zone: string;
  subject: string;
  body: string;
  /** The next scheduled instant as ISO, or null for a one-off that has passed. */
  nextSendAt: string | null;
  recipients: RecipientRow[];
  recent: {
    occurrence_at: string;
    sent: number;
    failed: number;
    sending: number;
  }[];
}

/** One reminder for the screen. `log` must be newest first; its last five distinct occurrences are summarised. */
export function reminderState(
  row: ReminderRow,
  recipients: RecipientRow[],
  log: SendLogRow[],
  now: Date
): ReminderState {
  const recent: ReminderState["recent"] = [];
  const byOccurrence = new Map<string, ReminderState["recent"][number]>();

  for (const entry of log) {
    let counts = byOccurrence.get(entry.occurrence_at);
    if (!counts) {
      if (recent.length >= RECENT_OCCURRENCES) break;
      counts = { occurrence_at: entry.occurrence_at, sent: 0, failed: 0, sending: 0 };
      byOccurrence.set(entry.occurrence_at, counts);
      recent.push(counts);
    }
    counts[entry.status] += 1;
  }

  const next = nextOccurrence(ruleForReminder(row), now);

  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    schedule_kind: row.schedule_kind,
    weekday: row.weekday,
    once_date: row.once_date,
    send_time: row.send_time,
    time_zone: row.time_zone,
    subject: row.subject,
    body: row.body,
    nextSendAt: next ? next.toISOString() : null,
    recipients: recipients.map((recipient) => ({
      name: recipient.name,
      email: recipient.email,
    })),
    recent,
  };
}
