/** Whether this signed-in email is on the block's short preview list: those accounts see the comics'
 * show-day lineup screen at any time, for testing before the show day. Case and surrounding spaces
 * never matter; anything that isn't a list of strings matches nobody. */
export function isLineupPreviewer(emails: unknown, email: string | null | undefined): boolean {
  if (!Array.isArray(emails) || typeof email !== "string") return false;
  const mine = email.trim().toLowerCase();
  if (!mine) return false;
  return emails.some((entry) => typeof entry === "string" && entry.trim().toLowerCase() === mine);
}
