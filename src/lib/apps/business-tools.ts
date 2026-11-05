import { CalendarClock, Mail, UsersRound, Zap, type LucideIcon } from "lucide-react";

/** One of the private business sections that comes with Scheduling switched on. */
export interface BusinessTool {
  /** The dashboard section, after `/dashboard/apps/<appId>/`. */
  path: string;
  label: string;
  /** One line, in the same words the app home page's Manage list uses. */
  hint: string;
  icon: LucideIcon;
}

/**
 * The owner-facing side of Scheduling: the four sections an app gets once it has a `schedule_settings` row.
 * The app home page's Manage list and the builder's "Business tools" menu both read this, so the two cannot drift.
 */
export const BUSINESS_TOOLS: BusinessTool[] = [
  { path: "schedule", label: "Schedule", hint: "Visits and repeats", icon: CalendarClock },
  { path: "customers", label: "Customers", hint: "People you visit", icon: UsersRound },
  { path: "reminders", label: "Reminders", hint: "Emails before each visit", icon: Mail },
  { path: "automation", label: "Automation", hint: "Messages to people you choose", icon: Zap },
];

/**
 * The one line under a Scheduling app's name on the dashboard, e.g. "Today: 3 visits · 24 customers".
 * A business with no customers yet is pointed at its first one; zero visits on a normal day is not bad news.
 */
export function schedulingCardSummary(visitsToday: number, customers: number): string {
  if (visitsToday === 0 && customers === 0) {
    return "Nothing yet. Add your first customer.";
  }
  const visits =
    visitsToday === 0
      ? "No visits today"
      : `Today: ${visitsToday} ${visitsToday === 1 ? "visit" : "visits"}`;
  const people =
    customers === 0
      ? "No customers yet"
      : `${customers} ${customers === 1 ? "customer" : "customers"}`;
  return `${visits} · ${people}`;
}
