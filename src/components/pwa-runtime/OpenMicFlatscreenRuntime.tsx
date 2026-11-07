import type { OpenMicSignupBlockConfig } from "@/types/database";

/**
 * The show's flyer full screen for a flat-screen TV at the venue (block view "tv", its own page, e.g. /tv). A black
 * page with the flyer kept whole, portrait or landscape, and the show's address along the bottom. First version: the
 * flyer only, no countdown.
 */
export function OpenMicFlatscreenRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black text-white">
      {config.flyer_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
        <img src={config.flyer_url} alt={`${config.show_name ?? "The show"} flyer`} className="h-full w-auto max-w-full object-contain" />
      ) : (
        <p className="text-2xl font-semibold text-white/70">No flyer yet.</p>
      )}
      <p className="absolute bottom-6 left-8 text-lg font-semibold text-white/70">stagetimepnw.tapandlaunch.com</p>
    </div>
  );
}
