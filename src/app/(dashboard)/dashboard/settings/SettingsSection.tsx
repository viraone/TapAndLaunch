import type { LucideIcon } from "lucide-react";

/** One card on the Settings page: a gradient icon tile, a title (with an optional tag) and what the card is for. */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  tag,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tag?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-8">
      <header className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-lg shadow-indigo-500/30">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-neutral-950">
            {title}
            {tag}
          </h2>
          {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
        </div>
      </header>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** The "Test mode" tag shown next to billing and payments while Stripe runs on sandbox keys. */
export function TestModeTag() {
  return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Test mode</span>;
}

/** The pill button used across Settings. */
export const PRIMARY_BUTTON =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50";
export const FIELD = "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-[15px] text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5";
export const LABEL = "mb-1.5 block text-sm font-medium text-neutral-800";
