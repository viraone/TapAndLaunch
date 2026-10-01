/**
 * The letter tile that stands in for an app's icon until one is uploaded:
 * the dashboard draws it with Tailwind classes, and the published app's
 * generated install icon (`/app-icon`) with the same colours as hex.
 * Index i of each list is the same gradient.
 */
export const TILE_GRADIENTS = [
  { classes: "from-indigo-500 to-violet-500", from: "#6366f1", to: "#8b5cf6" },
  { classes: "from-pink-500 to-rose-500", from: "#ec4899", to: "#f43f5e" },
  { classes: "from-emerald-500 to-teal-500", from: "#10b981", to: "#14b8a6" },
  { classes: "from-amber-400 to-orange-500", from: "#fbbf24", to: "#f97316" },
  { classes: "from-sky-500 to-blue-600", from: "#0ea5e9", to: "#2563eb" },
  { classes: "from-fuchsia-500 to-purple-600", from: "#d946ef", to: "#9333ea" },
] as const;

/** A stable gradient per app id, so each app keeps its colour everywhere. */
export function tileGradient(id: string): (typeof TILE_GRADIENTS)[number] {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_GRADIENTS[h % TILE_GRADIENTS.length];
}

export function tileInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "A";
}
