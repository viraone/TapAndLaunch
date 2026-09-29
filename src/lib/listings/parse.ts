export function isOpenMicDayActive(value: unknown): boolean {
  return /^y/i.test(String(value || "").trim());
}

export function parseTimeStringToMinutes(text: unknown): number | null {
  const value = String(text || "").trim();
  if (!value) return null;
  const ampmMatch = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?/i.exec(value);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]) % 12;
    const minute = ampmMatch[2] ? Number(ampmMatch[2]) : 0;
    if (/p/i.test(ampmMatch[3])) hour += 12;
    return hour * 60 + minute;
  }
  const militaryMatch = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (militaryMatch) {
    const hour = Number(militaryMatch[1]);
    const minute = Number(militaryMatch[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return hour * 60 + minute;
  }
  return null;
}

export function parseSignupStartTimes(rawTime: unknown): {
  signupMinutes: number | null;
  startMinutes: number | null;
} {
  const text = String(rawTime || "").trim();
  if (!text) return { signupMinutes: null, startMinutes: null };
  const slashIndex = text.indexOf("/");
  const signupPart = slashIndex === -1 ? "" : text.slice(0, slashIndex);
  const startPart = slashIndex === -1 ? text : text.slice(slashIndex + 1);
  const signupMinutes = parseTimeStringToMinutes(signupPart);
  const startMinutes = parseTimeStringToMinutes(startPart) ?? signupMinutes;
  return { signupMinutes, startMinutes };
}

export function normalizeOpenMicContact(value: unknown): {
  href: string;
  label: string;
  isLink: boolean;
} {
  const text = String(value || "").trim();
  if (!text) return { href: "", label: "", isLink: false };
  if (/^https?:\/\//i.test(text)) return { href: text, label: "Contact", isLink: true };

  const digits = text.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return { href: "", label: "", isLink: false };
  return { href: `tel:+1${national}`, label: text, isLink: false };
}

export function classifyOpenMicCategory(micType: unknown): "comedy" | "variety" | null {
  const text = String(micType || "").toLowerCase();
  if (!text) return null;
  const mentionsOtherTalent = /music|variety|mix|anything|talent|voice/.test(text);
  return mentionsOtherTalent ? "variety" : "comedy";
}
