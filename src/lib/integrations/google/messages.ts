/**
 * What the owner is told after Google sends them back to a dashboard screen with `?gmail=<result>`. A Map, so an
 * unknown value such as "constructor" from the query string simply shows nothing.
 */
export const GMAIL_MESSAGES = new Map<string, string>([
  ["connected", "Gmail is connected."],
  ["cancelled", "You closed Google's screen before finishing."],
  ["missing_permission", "Google didn't give permission to send email. Connect again and leave that box ticked."],
  ["failed", "That didn't work. Please try again."],
  ["unavailable", "Connecting Gmail isn't available yet."],
]);
