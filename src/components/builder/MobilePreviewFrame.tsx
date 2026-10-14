import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Monitor, Smartphone } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ThemeConfig } from "@/types/database";
import { fontsHref, themeAttributes, themeStyle } from "@/lib/pwa/theme-style";
import { lookOf } from "@/lib/pwa/look";
import { LookProvider } from "@/components/pwa-runtime/Look";

/** The preview root style: the primary colour plus the site-wide looks (fonts, button shape). */
function frameStyle(theme?: ThemeConfig): React.CSSProperties | undefined {
  if (!theme) return undefined;
  return { ...(theme.primary_color ? { "--primary": theme.primary_color } : {}), ...themeStyle(theme) } as React.CSSProperties;
}

export type DeviceFrame = "ios" | "android" | "desktop";

const DEVICE_LABELS: Record<DeviceFrame, string> = {
  ios: "iPhone",
  android: "Android",
  desktop: "Computer",
};

/**
 * One small menu instead of three side-by-side buttons: it only changes the device drawn around the preview, so it
 * does not need to take up space all the time. It names what is picked ("iPhone", "Android", "Computer").
 */
export function DeviceFrameSwitcher({
  value,
  onChange,
}: {
  value: DeviceFrame;
  onChange: (value: DeviceFrame) => void;
}) {
  const Icon = value === "desktop" ? Monitor : Smartphone;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Show the preview on: ${DEVICE_LABELS[value]}`}
        title="Choose what the preview looks like on"
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-neutral-300 transition hover:bg-white/10 hover:text-white"
      >
        <Icon className="h-4 w-4" /> {DEVICE_LABELS[value]}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dark">
        {(["ios", "android", "desktop"] as const).map((frame) => (
          <DropdownMenuItem key={frame} onClick={() => onChange(frame)}>
            {frame === "desktop" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
            {DEVICE_LABELS[frame]}
            {value === frame && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const style = frameStyle(theme);
  const fonts = theme ? fontsHref(theme) : null;

  return (
    <div className="relative mx-auto w-fit">
      {fonts && <link rel="stylesheet" href={fonts} />}
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
          {...(theme ? themeAttributes(theme) : {})}
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

/** The width the desktop preview is drawn at, then shrunk to fit the builder's middle column. */
const DESKTOP_PREVIEW_WIDTH = 1180;

/**
 * A laptop-browser chrome around the canvas, for an app laid out as a website. The page is drawn at a real laptop
 * width and scaled down to fit, so the owner sees the true desktop layout: the top menu, wide photo grids, text at
 * reading width. Like the phone frame it is only framing, not a device emulator.
 */
export function DesktopPreviewFrame({ theme, children }: { theme?: ThemeConfig; children: React.ReactNode }) {
  const appDark = theme?.color_scheme === "dark";
  const style = frameStyle(theme);
  const fonts = theme ? fontsHref(theme) : null;
  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / DESKTOP_PREVIEW_WIDTH));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={holder} className="mx-auto w-full max-w-[1180px]">
      <div
        className="overflow-hidden rounded-xl bg-neutral-900 shadow-[0_40px_90px_-24px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.16)]"
        style={{ width: DESKTOP_PREVIEW_WIDTH, zoom: scale }}
      >
        {/* Browser chrome: three dots and an address pill */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-neutral-600" />
            <span className="h-3 w-3 rounded-full bg-neutral-600" />
            <span className="h-3 w-3 rounded-full bg-neutral-600" />
          </span>
          <span className="mx-auto h-6 w-1/2 rounded-full bg-white/10" />
        </div>
        <div style={style} {...(theme ? themeAttributes(theme) : {})} className={cn("@container flex h-[760px] flex-col overflow-y-auto bg-background text-foreground", appDark ? "dark" : "light")}>
          {fonts && <link rel="stylesheet" href={fonts} />}
          {children}
        </div>
      </div>
    </div>
  );
}

/** The preview frame for the chosen device: a phone, or a laptop browser. The sections inside draw themselves for
 * the app's look (lib/pwa/look.ts), the same way the published layout provides it. */
export function PreviewFrame({ device, theme, children }: { device: DeviceFrame; theme?: ThemeConfig; children: React.ReactNode }) {
  const inner = <LookProvider look={lookOf(theme)}>{children}</LookProvider>;
  return device === "desktop" ? (
    <DesktopPreviewFrame theme={theme}>{inner}</DesktopPreviewFrame>
  ) : (
    <MobilePreviewFrame device={device} theme={theme}>{inner}</MobilePreviewFrame>
  );
}
