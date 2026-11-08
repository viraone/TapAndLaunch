import { notFound } from "next/navigation";
import { DevPreview } from "./DevPreview";

/**
 * Dev-only visual check (2026-11-08): the StageTime timer and host bar in every state, with fixed values, so a
 * change to how they LOOK can be screenshotted before it is pushed. The dev server reads the production show clock,
 * so these states cannot be reached on the real pages without touching live data. 404 in production.
 */
// Rendered per request, never at build time, so the production build cannot trip on the notFound() below.
export const dynamic = "force-dynamic";

export default function DevPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevPreview />;
}
