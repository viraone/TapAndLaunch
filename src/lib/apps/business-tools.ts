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
