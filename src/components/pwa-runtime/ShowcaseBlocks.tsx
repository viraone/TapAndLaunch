import { ArrowRight, Clock, MapPin, Phone, Star } from "lucide-react";
import { EditableImage, EditableText, ReplacePhotoButton } from "@/components/pwa-runtime/Editable";
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
      <EditableText path={["button_label"]} value={label} placeholder="Button" /> <ArrowRight className="h-4 w-4" />
    </span>
  ) : null;
  return (
    <section className="relative isolate overflow-hidden @lg:mx-6 @lg:my-6 @lg:rounded-3xl">
      {config.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- template photos and tenant uploads, any host
        <img src={config.image_url} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 -z-20 bg-primary" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
      {/* Builder only: the photo is behind the words, so it gets its own button. */}
      <ReplacePhotoButton path={["image_url"]} label={config.image_url ? "Replace the background photo" : "Add a background photo"} className="absolute bottom-4 right-4 z-10" />
      <div className="flex min-h-[24rem] flex-col justify-end px-5 pb-8 pt-28 text-white @lg:min-h-[34rem] @lg:px-14 @lg:pb-14">
        <EditableText as="span" path={["eyebrow"]} value={config.eyebrow} placeholder="Small label" className="mb-3 inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur" />
        <EditableText as="h2" path={["headline"]} value={config.headline} placeholder="Your headline" className="text-balance text-[2.1rem] font-extrabold leading-[1.02] tracking-tight @lg:max-w-3xl @lg:text-6xl" />
        <EditableText as="div" path={["subtext"]} value={config.subtext} placeholder="A line under the headline" rich className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/85 @lg:mt-5 @lg:max-w-xl @lg:text-lg" />
        {button && (live && config.button_page ? <a href={`/${config.button_page}`} className="w-fit">{button}</a> : <span className="w-fit">{button}</span>)}
      </div>
    </section>
  );
}

export function StatsBlockView({ config, live }: { config: StatsBlockConfig; live: boolean }) {
  const items = (config.items ?? []).slice(0, 4).map((item, index) => ({ ...item, index })).filter((i) => !live || i.value || i.label);
  if (items.length === 0) return null;
  return (
    <section className="px-4 py-5 @lg:mx-auto @lg:max-w-4xl @lg:px-8 @lg:py-8">
      <dl className="grid gap-2 @lg:gap-4" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <div key={item.index} className="rounded-2xl bg-muted/60 px-2 py-4 text-center ring-1 ring-border @lg:py-7">
            <dt className="sr-only">{item.label}</dt>
            <EditableText as="dd" path={["items", item.index, "value"]} value={item.value} placeholder="4.9★" className="text-2xl font-extrabold tracking-tight text-primary @lg:text-4xl" />
            <EditableText as="p" path={["items", item.index, "label"]} value={item.label} placeholder="Label" className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground @lg:mt-1.5 @lg:text-xs" />
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PriceListBlockView({ config, live }: { config: PriceListBlockConfig; live: boolean }) {
  const sections = (config.sections ?? []).map((section, index) => ({ ...section, index })).filter((s) => !live || s.items?.length);
  return (
    <section className="px-5 py-6 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-10">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Menu" className="text-2xl font-extrabold tracking-tight @lg:text-4xl" />
      <EditableText as="p" path={["subtitle"]} value={config.subtitle} placeholder="A line under the title" className="mt-1 text-sm text-muted-foreground" />
      <div className="mt-5 space-y-7">
        {sections.map((section) => (
          <div key={section.index}>
            <EditableText as="h3" path={["sections", section.index, "name"]} value={section.name} placeholder="Section" className="text-xs font-bold uppercase tracking-[0.18em] text-primary" />
            <ul className="mt-3 divide-y divide-border">
              {(section.items ?? []).map((item, ii) => (
                <li key={ii} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                      <EditableText path={["sections", section.index, "items", ii, "name"]} value={item.name} placeholder="Item" />
                      {(item.badge || !live) && <EditableText path={["sections", section.index, "items", ii, "badge"]} value={item.badge} placeholder="badge" className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary" />}
                    </p>
                    <EditableText as="p" path={["sections", section.index, "items", ii, "description"]} value={item.description} placeholder="Description" rich className="mt-0.5 text-sm leading-snug text-muted-foreground" />
                  </div>
                  <EditableText path={["sections", section.index, "items", ii, "price"]} value={item.price} placeholder="$0" className="shrink-0 text-[15px] font-bold tabular-nums" />
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
  const rows = (config.rows ?? []).map((row, index) => ({ ...row, index })).filter((r) => !live || r.label || r.value);
  const maps = config.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}` : null;
  const tel = config.phone ? `tel:${config.phone.replace(/[^\d+]/g, "")}` : null;
  return (
    <section className="px-4 py-5 @lg:mx-auto @lg:max-w-2xl @lg:px-8 @lg:py-8">
      <div className="rounded-3xl bg-muted/60 p-5 ring-1 ring-border @lg:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Clock className="h-5 w-5 text-primary" /> <EditableText path={["title"]} value={config.title} fallback="Hours" placeholder="Hours" />
        </h2>
        {rows.length > 0 && (
          <dl className="mt-3 space-y-2">
            {rows.map((r) => (
              <div key={r.index} className="flex justify-between gap-4 text-[15px]">
                <EditableText as="dt" path={["rows", r.index, "label"]} value={r.label} placeholder="Mon to Fri" className="text-muted-foreground" />
                <EditableText as="dd" path={["rows", r.index, "value"]} value={r.value} placeholder="9am to 6pm" className="text-right font-semibold" />
              </div>
            ))}
          </dl>
        )}
        {(config.address || config.phone || !live) && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {(config.address || !live) && (
              <p className="flex items-start gap-2 text-[15px]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <EditableText path={["address"]} value={config.address} placeholder="Street address, city" />
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

export function ReviewsBlockView({ config, live }: { config: ReviewsBlockConfig; live: boolean }) {
  const items = (config.items ?? []).map((item, index) => ({ ...item, index })).filter((i) => !live || i.quote);
  if (items.length === 0) return null;
  return (
    <section className="py-6 @lg:mx-auto @lg:max-w-5xl @lg:px-8 @lg:py-10">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="What people say" className="px-5 text-2xl font-extrabold tracking-tight @lg:px-0 @lg:text-4xl" />
      <ul className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] @lg:grid @lg:grid-cols-2 @lg:gap-5 @lg:overflow-visible @lg:px-0 @3xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.index} className="w-[82%] shrink-0 snap-start rounded-3xl bg-muted/60 p-5 ring-1 ring-border @lg:w-auto @lg:p-6">
            <div className="flex gap-0.5 text-amber-400" aria-label={`${item.rating ?? 5} out of 5 stars`}>
              {Array.from({ length: Math.max(1, Math.min(5, item.rating ?? 5)) }, (_, s) => (
                <Star key={s} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="mt-3 text-[15px] leading-relaxed">&ldquo;<EditableText path={["items", item.index, "quote"]} value={item.quote} placeholder="What they said" multiline />&rdquo;</p>
            <EditableText as="p" path={["items", item.index, "name"]} value={item.name} placeholder="Their name" className="mt-3 text-sm font-semibold text-muted-foreground" />
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
    <section className="px-4 py-5 @lg:mx-auto @lg:max-w-6xl @lg:px-8 @lg:py-10">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Photos" className="mb-3 px-1 text-2xl font-extrabold tracking-tight @lg:mb-6 @lg:text-4xl" />
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3 @lg:gap-4 @5xl:grid-cols-4">
        {images.slice(0, 24).map((img, i) => (
          <EditableImage
            key={i}
            path={["images", i, "src"]}
            src={img.src}
            alt={img.alt ?? ""}
            className={`w-full rounded-2xl object-cover @lg:col-span-1 @lg:aspect-square ${i === 0 && images.length % 2 === 1 ? "col-span-2 aspect-[16/10]" : "aspect-square"}`}
          />
        ))}
      </div>
    </section>
  );
}
