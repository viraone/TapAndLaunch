/** Hosts who do not get the Calendar tab. The app's Calendar tab entry carries hide_if "openmic-hide-calendar". */
export const HIDE_CALENDAR_FLAG = "openmic-hide-calendar";
export const HIDE_CALENDAR_EMAILS = ["vxayananh@gmail.com", "nickrcody@gmail.com", "dinodadcomedy@gmail.com"];
export function hidesCalendarTab(email: string | null | undefined): boolean {
  return !!email && HIDE_CALENDAR_EMAILS.includes(email.trim().toLowerCase());
}
