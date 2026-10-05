import type { RawGoogleReview } from "@/lib/food/google";

/** One review as the app shows it. */
export interface PlaceReview {
  author: string;
  /** The reviewer's Google Maps profile (Google's terms ask that the name link to it). Null if Google gave none we can trust. */
  authorUrl: string | null;
  photoUrl: string | null;
  rating: number;
  /** Google's own wording: "2 weeks ago", "a month ago". */
  when: string;
  text: string;
}

export const MAX_REVIEWS = 5;
export const MAX_REVIEW_CHARS = 1200;

/** An https URL on a Google host (profiles and photos only come from there); otherwise null. */
export function googleUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return /(^|\.)(google\.com|googleusercontent\.com|ggpht\.com)$/i.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Google's reviews, cleaned for display: text only, no empty or rating-only entries, links limited to Google. */
export function shapeReviews(raw: RawGoogleReview[] | null | undefined): PlaceReview[] {
  const out: PlaceReview[] = [];
  for (const r of raw ?? []) {
    const text = String(r.originalText?.text ?? r.text?.text ?? "").replace(/\s+/g, " ").trim();
    const rating = typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5 ? Math.round(r.rating) : null;
    if (!text || rating === null) continue;
    out.push({
      author: String(r.authorAttribution?.displayName ?? "").trim().slice(0, 60) || "A Google user",
      authorUrl: googleUrl(r.authorAttribution?.uri),
      photoUrl: googleUrl(r.authorAttribution?.photoUri),
      rating,
      when: String(r.relativePublishTimeDescription ?? "").trim().slice(0, 40),
      text: text.length > MAX_REVIEW_CHARS ? `${text.slice(0, MAX_REVIEW_CHARS).trimEnd()}…` : text,
    });
    if (out.length >= MAX_REVIEWS) break;
  }
  return out;
}
