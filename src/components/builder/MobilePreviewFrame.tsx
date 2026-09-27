import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DeviceFrame = "ios" | "android";

export function DeviceFrameSwitcher({
  value,
  onChange,
}: {
  value: DeviceFrame;
  onChange: (value: DeviceFrame) => void;
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {(["ios", "android"] as const).map((frame) => (
        <Button
          key={frame}
          type="button"
          size="sm"
          variant={value === frame ? "default" : "ghost"}
          className="capitalize"
          onClick={() => onChange(frame)}
        >
          {frame}
        </Button>
      ))}
    </div>
  );
}

/**
 * A cosmetic phone chrome around the live canvas — not a real device
 * emulator (no viewport scaling/zoom controls), just enough visual framing
 * for a creator to judge how content reads on a phone-sized screen.
 */
export function MobilePreviewFrame({
  device,
  children,
}: {
  device: DeviceFrame;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex h-[720px] w-[360px] flex-col overflow-hidden border-8 border-neutral-900 bg-background shadow-xl",
        device === "ios" ? "rounded-[2.5rem]" : "rounded-2xl"
      )}
    >
      {device === "ios" && (
        <div className="mx-auto -mb-2 mt-1 h-5 w-32 rounded-full bg-neutral-900" />
      )}
      <div className="flex-1 overflow-y-auto">{children}</div>
      {device === "android" && <div className="mx-auto mb-1 h-1 w-24 rounded-full bg-neutral-300" />}
    </div>
  );
}
