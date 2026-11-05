import { renderTemplateMessage } from "@/lib/reminders/render";
import { formatLongDate } from "./schedule";
import { AUTOMATION_TOKENS } from "./validate";

/** What one automation email should say, before the {tokens} are filled in. */
export interface AutomationValuesInput {
  name: string;
  showName: string;
  /** "YYYY-MM-DD", the show date the reminder talks about. */
  showDate: string;
  showTime: string | null;
  venue: string | null;
}

/** The text each AUTOMATION_TOKENS placeholder stands for, already written the way the recipient will read it. */
export function automationValues(input: AutomationValuesInput): Record<string, string> {
  const name = input.name.trim().replace(/\s+/g, " ");
  return {
    first_name: name.split(/\s+/)[0] ?? "",
    name,
    show_name: input.showName,
    show_date: formatLongDate(input.showDate),
    show_time: input.showTime ?? "",
    venue: input.venue ?? "",
    // The business the message comes from. The sender passes the show name, or the app name when the app has no
    // open-mic block, so a Scheduling app's {business} is that app's name.
    business: input.showName,
  };
}

/** The subject, plain text and HTML for one automation email. */
export function renderAutomation(
  settings: { subject: string; body: string },
  values: Record<string, string>
): { subject: string; text: string; html: string } {
  return renderTemplateMessage(settings.subject, settings.body, null, values, AUTOMATION_TOKENS);
}
