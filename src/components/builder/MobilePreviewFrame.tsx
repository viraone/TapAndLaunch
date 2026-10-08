import { cn } from "@/lib/utils";
import type { ThemeConfig } from "@/types/database";

export type DeviceFrame = "ios" | "android";

export function DeviceFrameSwitcher({
  value,
  onChange,
}: {
  value: DeviceFrame;
  onChange: (value: DeviceFrame) => void;
}) {
  // Says what it is for: it only changes the phone drawn around the preview. Bare "iOS / Android" read as two apps to build.
  return (
    <div role="group" aria-label="Preview on" className="inline-flex items-center gap-2">
      <span className="hidden text-xs text-neutral-500 lg:inline" aria-hidden>
        Preview on
      </span>
      <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5">
        {(["ios", "android"] as const).map((frame) => (
          <button
            key={frame}
            type="button"
            aria-pressed={value === frame}
            onClick={() => onChange(frame)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              value === frame ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-400 hover:text-white"
            )}
          >
            {frame === "ios" ? "iPhone" : "Android"}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A cosmetic phone chrome around the live canvas — not a real device
 * emulator (no viewport scaling/zoom controls), just enough visual framing
 * for a creator to judge how content reads on a phone-sized screen.
 *
 * The screen is an explicit `light` (or `dark`, per the app's colour
 * scheme) token scope with the app's `--primary` applied, so what's inside
 * matches the published app even though the builder shell around it is
 * dark.
 */
export function MobilePreviewFrame({
  device,
  theme,
  children,
}: {
  device: DeviceFrame;
  theme?: ThemeConfig;
  children: React.ReactNode;
}) {
  const appDark = theme?.color_scheme === "dark";
  const style = theme?.primary_color ? ({ "--primary": theme.primary_color } as React.CSSProperties) : undefined;

  return (
    <div className="relative mx-auto w-fit">
      {/* Glow behind the device */}
      {/* Floor shadow */}
      <div aria-hidden className="pointer-events-none absolute -bottom-8 left-1/2 h-10 w-72 -translate-x-1/2 rounded-[50%] bg-black/70 blur-xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 rounded-[4rem] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.25),rgba(236,72,153,0.12)_45%,transparent_70%)] blur-2xl"
      />
      <div
        className={cn(
          "relative flex h-[720px] w-[360px] flex-col overflow-hidden bg-gradient-to-b from-neutral-800 via-neutral-900 to-neutral-950 shadow-[0_40px_90px_-24px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.16),inset_0_1px_0_rgba(255,255,255,0.12)]",
          device === "ios" ? "rounded-[3rem] p-2.5" : "rounded-[1.75rem] p-2"
        )}
      >
        {/* Side buttons */}
        <span aria-hidden className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l bg-neutral-700" />
        <span aria-hidden className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l bg-neutral-700" />
        <span aria-hidden className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r bg-neutral-700" />

        <div
          style={style}
          className={cn(
            "relative flex flex-1 flex-col overflow-hidden bg-background text-foreground ring-1 ring-black/60",
            appDark ? "dark" : "light",
            device === "ios" ? "rounded-[2.4rem]" : "rounded-[1.25rem]"
          )}
        >
          {device === "ios" ? (
            <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-neutral-950" />
          ) : (
            <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-3 w-3 -translate-x-1/2 rounded-full bg-neutral-950" />
          )}
          {/* Status bar spacer so content clears the notch / camera */}
          <div className="h-9 shrink-0" />
          {/* Unlike the published-app runtime, the caller controls scrolling
              here (not a single wrapping overflow div) so a bottom nav preview
              can sit fixed below a scrollable block list, matching how the
              published app actually lays out. */}
          <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
          <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-foreground/30" />
        </div>
      </div>
    </div>
  );
}
