/**
 * What a visitor reads when a request fails for a reason that is not their fault. supabase-js and `fetch` hand back
 * raw text for these ("{}" when the server answers 500, "Failed to fetch" when the network is down), which tells a
 * person nothing. Used by the sign-up, log-in, forgot-password and reset-password pages and the new-app picker.
 */
export const NETWORK_ERROR = "Can't reach TapAndLaunch. Check your connection and try again.";
export const SERVER_ERROR = "Something went wrong on our side. Please try again in a minute.";

/** The parts of a supabase-js `AuthError` (or any thrown `Error`) this file reads. */
export interface ErrorLike {
  message?: string | null;
  status?: number | null;
  name?: string | null;
}

/** The browser could not talk to the server at all (offline, DNS, blocked). supabase-js reports it as status 0. */
export function isNetworkFailure(error: ErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.status === 0) return true;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|internet connection/i.test(error.message ?? "");
}

/** The server answered, but with a failure of its own (5xx), or with something no person could read. */
export function isServerFailure(error: ErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (typeof error.status === "number" && error.status >= 500) return true;
  if (error.name === "AuthRetryableFetchError") return true;
  const message = (error.message ?? "").trim();
  return message === "" || /^[[{]/.test(message) || /^(undefined|null)$/i.test(message);
}

/** A sentence for the person: the error's own message when it is readable, a plain explanation when it is not. */
export function friendlyError(error: ErrorLike | null | undefined): string {
  if (isNetworkFailure(error)) return NETWORK_ERROR;
  if (isServerFailure(error)) return SERVER_ERROR;
  return (error?.message ?? "").trim();
}
