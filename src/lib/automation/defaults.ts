import { DEFAULT_AUTOMATION } from "./validate";

/** Same limit parseAutomationInput puts on a message. */
const MAX_BODY_LENGTH = 3000;

/**
 * What a new reminder starts with on one app's Automation screen. The show's Open Mic Sign-Up block may carry its
 * own starting Message (`reminder_default_body`); anything unusable there falls back to the shared wording.
 */
export function automationDefaultsFor(
  config: { reminder_default_body?: unknown } | null | undefined
): typeof DEFAULT_AUTOMATION {
  const raw = config?.reminder_default_body;
  const body = typeof raw === "string" ? raw.replace(/\r\n/g, "\n").trim() : "";
  const usable = body.length > 0 && body.length <= MAX_BODY_LENGTH;
  return { ...DEFAULT_AUTOMATION, body: usable ? body : DEFAULT_AUTOMATION.body };
}
