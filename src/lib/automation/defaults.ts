import { DEFAULT_AUTOMATION } from "./validate";

/** Same limits parseAutomationInput puts on a subject and a message. */
const MAX_SUBJECT_LENGTH = 150;
const MAX_BODY_LENGTH = 3000;

/**
 * What a new reminder starts with on one app's Automation screen. The show's Open Mic Sign-Up block may carry its
 * own starting Subject (`reminder_default_subject`) and Message (`reminder_default_body`); anything unusable there
 * falls back to the shared wording, each on its own.
 */
export function automationDefaultsFor(
  config: { reminder_default_subject?: unknown; reminder_default_body?: unknown } | null | undefined
): typeof DEFAULT_AUTOMATION {
  const rawSubject = config?.reminder_default_subject;
  const subject = typeof rawSubject === "string" ? rawSubject.trim() : "";
  const subjectUsable =
    subject.length > 0 && subject.length <= MAX_SUBJECT_LENGTH && !/[\r\n]/.test(subject);

  const rawBody = config?.reminder_default_body;
  const body = typeof rawBody === "string" ? rawBody.replace(/\r\n/g, "\n").trim() : "";
  const bodyUsable = body.length > 0 && body.length <= MAX_BODY_LENGTH;

  return {
    ...DEFAULT_AUTOMATION,
    subject: subjectUsable ? subject : DEFAULT_AUTOMATION.subject,
    body: bodyUsable ? body : DEFAULT_AUTOMATION.body,
  };
}
