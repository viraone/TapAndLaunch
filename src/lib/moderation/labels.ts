import type { AppReportReason } from "@/types/database";

/** Why someone can report an app, in the words the report form shows. */
export const REPORT_REASON_LABELS: Record<AppReportReason, string> = {
  phishing: "It asks for passwords, bank or card details",
  scam: "It's a scam or fraud",
  malware: "It tries to download or install something harmful",
  illegal: "Illegal or abusive content",
  other: "Something else",
};

export const REPORT_REASONS = Object.keys(REPORT_REASON_LABELS) as AppReportReason[];
