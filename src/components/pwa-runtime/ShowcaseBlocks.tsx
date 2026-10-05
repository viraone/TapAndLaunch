import { ArrowRight, Clock, MapPin, Phone, Star } from "lucide-react";
import type { GalleryBlockConfig, HeroBlockConfig, HoursBlockConfig, PriceListBlockConfig, ReviewsBlockConfig, StatsBlockConfig } from "@/types/database";

/**
 * The "showcase" blocks: the ones that make a starter look like a real business on first open. They use the app's
 * theme tokens (`--primary`, `--background`, `--muted`...), so they look right in light and dark apps alike.
 * `live` is false in the builder's preview, where links don't navigate and empty blocks show a hint instead of nothing.
 */

export function HeroBlockView({ config, live }: { config: HeroBlockConfig; live: boolean }) {
  const label = config.button_label?.trim();
  const button = label ? (
    <span className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-white shadow-lg shadow-black/30">
      {label} <ArrowRight className="h-4 w-4" />
    </span>
  ) : null;
  return (
    <section className="relative isolate overflow-hidden">
      {config.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- template photos and tenant uploads, any host
        <img src={config.image_url} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 -z-20 bg-primary" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
      <div className="flex min-h-[24rem] flex-col justify-end px-5 pb-8 pt-28 text-white">
        {config.eyebrow && (
          <span className="mb-3 inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur">
            {config.eyebrow}
          </span>
        )}
        {config.headline && <h2 className="text-balance text-[2.1rem] font-extrabold leading-[1.02] tracking-tight">{config.headline}</h2>}
        {config.subtext && <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/85">{config.subtext}</p>}
        {button && (live && config.button_page ? <a href={`/${config.button_page}`} className="w-fit">{button}</a> : <span className="w-fit">{button}</span>)}
      </div>
    </section>
  );
}

export function StatsBlockView({ config }: { config: StatsBlockConfig }) {
  const items = (config.items ?? []).filter((i) => i.value || i.label).slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section className="px-4 py-5">
      <dl className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item, i) => (
          <div key={i} className="rounded-2xl bg-muted/60 px-2 py-4 text-center ring-1 ring-border">
            <dt className="sr-only">{item.label}</dt>
            <dd className="text-2xl font-extrabold tracking-tight text-primary">{item.value}</dd>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PriceListBlockView({ config }: { config: PriceListBlockConfig }) {
  const sections = (config.sections ?? []).filter((s) => s.items?.length);
  return (
    <section className="px-5 py-6">
      {config.title && <h2 className="text-2xl font-extrabold tracking-tight">{config.title}</h2>}
      {config.subtitle && <p className="mt-1 text-sm text-muted-foreground">{config.subtitle}</p>}
      <div className="mt-5 space-y-7">
        {sections.map((section, si) => (
          <div key={si}>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{section.name}</h3>
            <ul className="mt-3 divide-y divide-border">
              {section.items.map((item, ii) => (
                <li key={ii} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                      {item.name}
                      {item.badge && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{item.badge}</span>}
                    </p>
                    {item.description && <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{item.description}</p>}
                  </div>
                  {item.price && <span className="shrink-0 text-[15px] font-bold tabular-nums">{item.price}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HoursBlockView({ config, live }: { config: HoursBlockConfig; live: boolean }) {
  const rows = (config.rows ?? []).filter((r) => r.label || r.value);
  const maps = config.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}` : null;
  const tel = config.phone ? `tel:${config.phone.replace(/[^\d+]/g, "")}` : null;
  return (
    <section className="px-4 py-5">
      <div className="rounded-3xl bg-muted/60 p-5 ring-1 ring-border">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Clock className="h-5 w-5 text-primary" /> {config.title || "Hours"}
        </h2>
        {rows.length > 0 && (
          <dl className="mt-3 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex justify-between gap-4 text-[15px]">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="text-right font-semibold">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {(config.address || config.phone) && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {config.address && (
              <p className="flex items-start gap-2 text-[15px]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {config.address}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {maps && (
                <a href={live ? maps : undefined} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-white">
                  <MapPin className="h-4 w-4" /> Directions
                </a>
              )}
              {tel && (
                <a href={live ? tel : undefined} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-background px-4 text-sm font-bold ring-1 ring-border">
                  <Phone className="h-4 w-4" /> Call
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function ReviewsBlockView({ config }: { config: ReviewsBlockConfig }) {
  const items = (config.items ?? []).filter((i) => i.quote);
  if (items.length === 0) return null;
  return (
    <section className="py-6">
      {config.title && <h2 className="px-5 text-2xl font-extrabold tracking-tight">{config.title}</h2>}
      <ul className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
        {items.map((item, i) => (
          <li key={i} className="w-[82%] shrink-0 snap-start rounded-3xl bg-muted/60 p-5 ring-1 ring-border">
            <div className="flex gap-0.5 text-amber-400" aria-label={`${item.rating ?? 5} out of 5 stars`}>
              {Array.from({ length: Math.max(1, Math.min(5, item.rating ?? 5)) }, (_, s) => (
                <Star key={s} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="mt-3 text-[15px] leading-relaxed">&ldquo;{item.quote}&rdquo;</p>
            <p className="mt-3 text-sm font-semibold text-muted-foreground">{item.name}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GalleryBlockView({ config, live }: { config: GalleryBlockConfig; live: boolean }) {
  const images = (config.images ?? []).filter((i) => i.src);
  if (images.length === 0) {
    if (live) return null;
    return <div className="mx-4 my-3 flex h-32 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">No photos yet</div>;
  }
  return (
    <section className="px-4 py-5">
      {config.title && <h2 className="mb-3 px-1 text-2xl font-extrabold tracking-tight">{config.title}</h2>}
      <div className="grid grid-cols-2 gap-2">
        {images.slice(0, 9).map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- template photos and tenant uploads, any host
          <img
            key={i}
            src={img.src}
            alt={img.alt ?? ""}
            loading="lazy"
            className={`w-full rounded-2xl object-cover ${i === 0 && images.length % 2 === 1 ? "col-span-2 aspect-[16/10]" : "aspect-square"}`}
          />
        ))}
      </div>
    </section>
  );
}
