import { buildStarter, type StarterBlock } from "@/lib/apps/templates";

/** A tiny phone showing what a starter looks like, drawn from the starter's own blocks so it always matches what the customer gets. */
export function TemplatePreview({ templateId, color }: { templateId: string; color: string }) {
  const starter = buildStarter(templateId, "App");
  const home = starter.pages.find((p) => p.isHome) ?? starter.pages[0];
  const dark = starter.theme.color_scheme === "dark";
  const nav = starter.theme.bottom_nav ?? [];
  const bg = dark ? "#0a0a0a" : "#ffffff";
  const ink = dark ? "#e5e5e5" : "#262626";
  const soft = dark ? "#2a2a2a" : "#e5e5e5";

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
