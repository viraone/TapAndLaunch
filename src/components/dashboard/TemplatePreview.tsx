import { STARTER_TEMPLATES, buildStarter, type StarterBlock, type StarterPage } from "@/lib/apps/templates";
import type { HeroBlockConfig, StatsBlockConfig } from "@/types/database";

/** A tiny phone (or, for a website-layout starter, a tiny browser window) showing what a starter looks like, drawn
 * from the starter's own blocks so it always matches what the customer gets. */
export function TemplatePreview({ templateId, color }: { templateId: string; color: string }) {
  const starter = buildStarter(templateId, "App");
  const home = starter.pages.find((p) => p.isHome) ?? starter.pages[0];
  const dark = starter.theme.color_scheme === "dark";
  const nav = starter.theme.bottom_nav ?? [];
  const bg = dark ? "#0a0a0a" : "#ffffff";
  const ink = dark ? "#e5e5e5" : "#262626";
  const soft = dark ? "#2a2a2a" : "#e5e5e5";

  if (starter.theme.layout === "website") {
    return <WebsiteMockup home={home} name={STARTER_TEMPLATES.find((t) => t.id === templateId)?.name ?? "Your site"} color={color} />;
  }

  return (
    <div
      aria-hidden
      className="relative flex h-44 items-end justify-center overflow-hidden rounded-2xl"
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${color} 22%, white), color-mix(in oklab, ${color} 8%, white))` }}
    >
      <div className="relative -mb-3 h-[10.5rem] w-24 overflow-hidden rounded-[1.1rem] border-[3px] border-neutral-900 shadow-xl" style={{ background: bg }}>
        <div className="flex h-4 items-center gap-1 px-2" style={{ background: color }}>
          <span className="h-1 w-6 rounded-full bg-white/90" />
        </div>
        {home?.blocks[0]?.type === "hero" && <HeroSkeleton block={home.blocks[0]} color={color} />}
        <div className="space-y-1.5 p-2">
          {(home?.blocks ?? []).filter((b, i) => !(i === 0 && b.type === "hero")).slice(0, 4).map((b, i) => (
            <Skeleton key={i} block={b} color={color} ink={ink} soft={soft} />
          ))}
          {(home?.blocks ?? []).length === 0 && <div className="mt-6 text-center text-[8px] font-medium" style={{ color: soft }}>Your app</div>}
        </div>
        {nav.length > 1 && (
          <div className="absolute inset-x-0 bottom-0 flex h-5 items-center justify-around border-t px-2" style={{ background: bg, borderColor: soft }}>
            {nav.slice(0, 4).map((n, i) => (
              <span key={n.page_path} className="h-1.5 w-1.5 rounded-full" style={{ background: i === 0 ? color : soft }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A website starter as a tiny real site, not a wireframe: the site's own name in the menu, the banner's actual
 * eyebrow and headline, the real highlight numbers, and the trade's extra row (gallery tiles, shop cards). The
 * window sits on a dark backdrop lit by the brand colour and runs off the card's edges, so sixteen of them in a row
 * read as sixteen different sites.
 */
function WebsiteMockup({ home, name, color }: { home: StarterPage | undefined; name: string; color: string }) {
  const blocks = home?.blocks ?? [];
  const hero = blocks.find((b) => b.type === "hero")?.config as HeroBlockConfig | undefined;
  const stats = ((blocks.find((b) => b.type === "stats")?.config as StatsBlockConfig | undefined)?.items ?? []).slice(0, 3);
  const gallery = blocks.some((b) => b.type === "gallery");
  const shop = blocks.some((b) => b.type === "product_list");
  const tint = (pct: number) => `color-mix(in oklab, ${color} ${pct}%, white)`;

  return (
    <div
      aria-hidden
      className="relative h-48 overflow-hidden rounded-2xl bg-neutral-950"
      style={{ background: `radial-gradient(140% 120% at 10% 20%, color-mix(in oklab, ${color} 55%, #0a0a0a) 0%, color-mix(in oklab, ${color} 18%, #0a0a0a) 100%)` }}
    >
      <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full opacity-50 blur-3xl" style={{ background: color }} />
      <div className="absolute left-4 right-[-10%] top-5 overflow-hidden rounded-t-xl bg-white shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/15">
        <div className="flex h-5 items-center gap-1 bg-neutral-100 px-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
          <span className="ml-2 h-2 w-24 rounded-full bg-white ring-1 ring-neutral-200" />
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="truncate text-[8px] font-bold tracking-tight text-neutral-950">{name}</span>
          <span className="flex items-center gap-2 text-[6px] font-medium text-neutral-500">
            <span className="rounded-full px-1.5 py-0.5 font-semibold text-white" style={{ background: color }}>
              Home
            </span>
            <span>About</span>
            <span>Contact</span>
          </span>
        </div>
        <div className="relative px-3 pb-2.5 pt-3" style={{ background: color }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
          <div className="relative">
            {hero?.eyebrow && <p className="mb-1 text-[5px] font-bold uppercase tracking-[0.2em] text-white/80">{hero.eyebrow}</p>}
            <p className="line-clamp-2 text-[11px] font-extrabold leading-[1.05] tracking-tight text-white">{hero?.headline ?? "Your headline"}</p>
            <span className="mt-2 inline-block rounded-full bg-white px-2 py-0.5 text-[5px] font-bold text-neutral-950">{hero?.button_label ?? "Get in touch"}</span>
          </div>
        </div>
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 px-2.5 pt-2.5">
            {stats.map((s, i) => (
              <div key={i} className="rounded-md bg-neutral-100 px-1 py-1.5 text-center">
                <p className="truncate text-[8px] font-extrabold tracking-tight" style={{ color }}>
                  {s.value}
                </p>
                <p className="truncate text-[4.5px] font-medium uppercase tracking-wide text-neutral-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}
        {(gallery || shop) && (
          <div className="grid grid-cols-3 gap-1.5 px-2.5 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-7 rounded-md" style={{ background: `linear-gradient(135deg, ${tint(45 - i * 8)}, ${tint(18)})` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HeroSkeleton({ block, color }: { block: StarterBlock; color: string }) {
  const src = (block.config as { image_url?: string }).image_url;
  return (
    <div className="relative h-20 overflow-hidden" style={{ background: color }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small template photo */}
      {src && <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/5" />
      <div className="absolute inset-x-2 bottom-2 space-y-1">
        <div className="h-1.5 w-4/5 rounded-full bg-white" />
        <div className="h-1 w-3/5 rounded-full bg-white/70" />
        <div className="mt-1 h-2.5 w-10 rounded-full" style={{ background: color }} />
      </div>
    </div>
  );
}

function Skeleton({ block, color, ink, soft }: { block: StarterBlock; color: string; ink: string; soft: string }) {
  switch (block.type) {
    case "text":
      return (
        <div className="space-y-1">
          <div className="h-1.5 w-2/3 rounded-full" style={{ background: ink }} />
          <div className="h-1 w-full rounded-full" style={{ background: soft }} />
          <div className="h-1 w-4/5 rounded-full" style={{ background: soft }} />
        </div>
      );
    case "image":
      return <div className="h-8 rounded-md" style={{ background: soft }} />;
    case "contact_form":
      return (
        <div className="space-y-1">
          <div className="h-2.5 rounded border" style={{ borderColor: soft }} />
          <div className="h-2.5 rounded border" style={{ borderColor: soft }} />
          <div className="h-2.5 w-1/2 rounded" style={{ background: color }} />
        </div>
      );
    case "product_list":
      return (
        <div className="grid grid-cols-2 gap-1">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-0.5">
              <div className="h-7 rounded" style={{ background: soft }} />
              <div className="h-1 w-3/4 rounded-full" style={{ background: ink }} />
            </div>
          ))}
        </div>
      );
    case "event_calendar":
      return (
        <div className="space-y-1">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="h-4 w-4 shrink-0 rounded" style={{ background: color, opacity: 0.85 }} />
              <div className="flex-1 space-y-0.5">
                <div className="h-1 w-3/4 rounded-full" style={{ background: ink }} />
                <div className="h-1 w-1/2 rounded-full" style={{ background: soft }} />
              </div>
            </div>
          ))}
        </div>
      );
    case "stats":
      return (
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-6 flex-col items-center justify-center gap-0.5 rounded" style={{ background: soft }}>
              <span className="h-1.5 w-3 rounded-full" style={{ background: color }} />
              <span className="h-0.5 w-4 rounded-full" style={{ background: ink, opacity: 0.4 }} />
            </div>
          ))}
        </div>
      );
    case "price_list":
      return (
        <div className="space-y-1">
          <div className="h-1.5 w-1/2 rounded-full" style={{ background: ink }} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-1">
              <div className="h-1 w-3/5 rounded-full" style={{ background: ink, opacity: 0.6 }} />
              <div className="h-1 w-3 rounded-full" style={{ background: color }} />
            </div>
          ))}
        </div>
      );
    case "gallery": {
      const images = ((block.config as { images?: Array<{ src: string }> }).images ?? []).filter((i) => i.src).slice(0, 3);
      return (
        <div className="grid grid-cols-2 gap-0.5">
          {images.length
            ? images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- small template photo
                <img key={i} src={img.src} alt="" className={`w-full rounded object-cover ${i === 0 && images.length % 2 === 1 ? "col-span-2 h-6" : "h-6"}`} />
              ))
            : [0, 1].map((i) => <div key={i} className="h-6 rounded" style={{ background: soft }} />)}
        </div>
      );
    }
    case "reviews":
    case "hours":
      return (
        <div className="space-y-1 rounded p-1" style={{ background: soft }}>
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="h-1 w-1 rounded-full" style={{ background: block.type === "reviews" ? "#fbbf24" : color }} />
            ))}
          </div>
          <div className="h-1 w-full rounded-full" style={{ background: ink, opacity: 0.4 }} />
          <div className="h-1 w-3/4 rounded-full" style={{ background: ink, opacity: 0.4 }} />
        </div>
      );
    case "hero":
      return <HeroSkeleton block={block} color={color} />;
    case "food_directory":
      // The finished app opens on a dark header with live numbers, then a list of places.
      return (
        <div className="-mx-2 -mt-1.5 space-y-1.5">
          <div className="space-y-1 px-2 pb-1.5 pt-2" style={{ background: "radial-gradient(circle at 20% 0%, rgba(251,146,60,0.55), transparent 60%), radial-gradient(circle at 90% 10%, rgba(244,63,94,0.4), transparent 55%), #0a0a0a" }}>
            <div className="h-1.5 w-4/5 rounded-full bg-white" />
            <div className="flex gap-0.5 pt-0.5">
              {["#34d399", "#fbbf24", "#ffffff"].map((c) => (
                <div key={c} className="flex h-4 flex-1 flex-col items-center justify-center gap-0.5 rounded bg-white/10">
                  <span className="h-1.5 w-2 rounded-full" style={{ background: c }} />
                  <span className="h-0.5 w-3 rounded-full bg-white/40" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1 px-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1 rounded border p-0.5" style={{ borderColor: soft }}>
                <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded text-[6px]" style={{ background: `color-mix(in oklab, ${color} 25%, white)` }}>
                  {["🍜", "🌮", "🍕"][i]}
                </span>
                <div className="flex-1 space-y-0.5">
                  <div className="h-1 w-3/4 rounded-full" style={{ background: ink, opacity: 0.8 }} />
                  <div className="h-0.5 w-1/2 rounded-full" style={{ background: i === 1 ? "#f59e0b" : "#10b981" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    default:
      // The live directories (food, gas, open mics): a short list.
      return (
        <div className="space-y-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: soft }} />
              <div className="h-1 flex-1 rounded-full" style={{ background: ink, opacity: 0.7 }} />
              <span className="h-2 w-3 rounded-full" style={{ background: color, opacity: 0.8 }} />
            </div>
          ))}
        </div>
      );
  }
}
