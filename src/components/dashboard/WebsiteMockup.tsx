import { websiteStyleOf, type StarterBlock, type StarterPage } from "@/lib/apps/templates";
import { themeStyle } from "@/lib/pwa/theme-style";
import { heroBackground, heroLayout, type HeroBackground, type LookId } from "@/lib/pwa/look";
import type { HeroBlockConfig, ImageTextBlockConfig, QuoteBlockConfig, StatsBlockConfig, ThemeConfig } from "@/types/database";

/**
 * A website starter as a tiny real site, drawn from the theme and pages the site will actually have: the header the
 * look gives it, the banner in its real layout and paint, then the first sections in their real order (the numbers,
 * the work, the story or the quote), in the real fonts on the real page colour with the real button shape. Nothing
 * here is a preview-only flourish: a design that looks different on the card is a site that looks different.
 */
export function WebsiteMockup({ home, theme, name, color }: { home: StarterPage | undefined; theme: ThemeConfig; name: string; color: string }) {
  const look = websiteStyleOf(theme);
  const blocks = home?.blocks ?? [];
  const heroBlock = blocks.find((b) => b.type === "hero");
  const hero = (heroBlock?.config ?? {}) as HeroBlockConfig;
  const layout = heroLayout(hero, look);
  const paint = heroBackground(hero, look);
  const primary = theme.primary_color ?? color;
  const dark = theme.color_scheme === "dark";
  const page = theme.background_color ?? (dark ? "#0a0a0a" : "#ffffff");
  const ink = dark ? "#f5f5f5" : "#111111";
  const muted = dark ? "rgba(255,255,255,0.62)" : "rgba(0,0,0,0.55)";
  const line = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)";
  const mix = (pct: number, base: string) => `color-mix(in oklab, ${primary} ${pct}%, ${base})`;
  // The accent each look derives in globals.css, unless the theme names one.
  const accent = theme.accent_color ?? (look === "editorial" ? mix(72, "#1c1917") : look === "cinematic" ? mix(62, "white") : primary);
  const surface = look === "cinematic" ? "rgba(255,255,255,0.06)" : look === "classic" ? (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : mix(look === "bold" ? 10 : 7, page);
  const vars = themeStyle(theme);
  const headingFont = vars["--font-heading"];
  const bodyFont = vars.fontFamily;
  const radius = vars["--button-radius"] ?? "9999px";
  const scale = theme.heading_size === "large" ? 1.15 : theme.heading_size === "compact" ? 0.88 : 1;
  const px = (n: number) => `${(n * scale).toFixed(1)}px`;
  // The two sections after the banner, in the site's real order. An empty video or audio box shows nothing on the
  // live site, so it shows nothing here either.
  const after = blocks.filter((b) => b !== heroBlock && b.type !== "video" && b.type !== "audio").slice(0, 2);

  const button = (cls = "") => (
    <span
      className={`inline-block px-2 py-0.5 text-[5px] font-bold ${cls}`}
      style={look === "cinematic" ? { background: accent, color: "#0a0a0a", borderRadius: radius } : { background: primary, color: "#ffffff", borderRadius: radius }}
    >
      {hero.button_label ?? "Get in touch"}
    </span>
  );
  const backdrop = (p: HeroBackground) =>
    p === "solid"
      ? primary
      : p === "mesh"
        ? `radial-gradient(70% 70% at 85% 80%, ${mix(55, "#000")} 0%, transparent 55%), radial-gradient(55% 55% at 12% 12%, ${mix(40, "#000")} 0%, transparent 60%), #0b0b0d`
        : `linear-gradient(135deg, ${primary}, ${mix(70, "#0a0a0a")})`;
  const grain = (p: HeroBackground) =>
    p === "grain" ? (
      <div aria-hidden className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:3px_3px]" />
    ) : null;

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ background: page, color: ink, fontFamily: bodyFont }}>
      {/* Zoomed so the site's few sections fill the frame the way a real screenshot of the top of a site would. */}
      <div style={{ zoom: 1.5 }}>
        <Header look={look} name={name} primary={primary} accent={accent} ink={ink} muted={muted} line={line} page={page} headingFont={headingFont} radius={radius} />

        {layout === "centered" && (
          <div className="px-4 pb-2 pt-3 text-center">
            {hero.eyebrow && (
              <p className="text-[5px] font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
                {hero.eyebrow}
              </p>
            )}
            <p className="mx-auto mt-1 line-clamp-2 font-bold leading-[1.05] tracking-tight" style={{ fontFamily: headingFont, fontSize: px(13) }}>
              {hero.headline}
            </p>
            <div className="mx-auto mt-1.5 h-px w-8" style={{ background: accent }} />
            <p className="mx-auto mt-1 line-clamp-1 text-[5.5px]" style={{ color: muted }}>
              {hero.subtext}
            </p>
            {button("mt-1.5")}
          </div>
        )}

        {layout === "minimal" && (
          <div className="px-3 pb-2 pt-3">
            {hero.eyebrow && (
              <p className="text-[5px] font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
                {hero.eyebrow}
              </p>
            )}
            <p className="mt-1 line-clamp-2 font-extrabold leading-[0.95] tracking-tighter" style={{ fontFamily: headingFont, fontSize: px(17) }}>
              {hero.headline}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3 border-t pt-1.5" style={{ borderColor: line }}>
              <p className="line-clamp-1 text-[5.5px]" style={{ color: muted }}>
                {hero.subtext}
              </p>
              {button("shrink-0")}
            </div>
          </div>
        )}

        {layout === "split" && (
          <div className="mx-2.5 mt-2 grid grid-cols-5 overflow-hidden rounded-lg" style={{ background: surface }}>
            <div className="col-span-3 px-3 py-3">
              {hero.eyebrow && (
                <p className="text-[5px] font-bold uppercase tracking-[0.25em]" style={{ color: accent }}>
                  {hero.eyebrow}
                </p>
              )}
              <p className="mt-1 line-clamp-3 font-bold leading-[1.05] tracking-tight" style={{ fontFamily: headingFont, fontSize: px(11) }}>
                {hero.headline}
              </p>
              <p className="mt-1 line-clamp-1 text-[5px]" style={{ color: muted }}>
                {hero.subtext}
              </p>
              {button("mt-1.5")}
            </div>
            <div className="relative col-span-2 min-h-[3.5rem]" style={{ background: backdrop(paint) }}>
              {grain(paint)}
            </div>
          </div>
        )}

        {layout === "full" && (
          <div className="relative mx-2.5 mt-2 overflow-hidden rounded-lg px-3 pb-3 pt-6" style={{ background: backdrop(paint) }}>
            {grain(paint)}
            <div className={`absolute inset-0 bg-gradient-to-t ${paint === "mesh" ? "from-black/70 via-black/20 to-transparent" : "from-black/80 via-black/40 to-black/5"}`} />
            <div className="relative text-white">
              {hero.eyebrow && <p className="mb-1 inline-block rounded-full bg-white/15 px-1.5 py-0.5 text-[4.5px] font-bold uppercase tracking-[0.18em]">{hero.eyebrow}</p>}
              <p
                className={`line-clamp-2 font-extrabold tracking-tight ${look === "bold" ? "uppercase leading-[0.95] tracking-wide" : "leading-[1.05]"}`}
                style={{ fontFamily: headingFont, fontSize: px(look === "bold" ? 15 : 11.5) }}
              >
                {hero.headline}
              </p>
              <p className="mt-1 line-clamp-1 max-w-[70%] text-[5px] text-white/85">{hero.subtext}</p>
              {button("mt-1.5")}
            </div>
          </div>
        )}

        {after.map((b, i) => (
          <Section key={i} block={b} look={look} primary={primary} accent={accent} ink={ink} muted={muted} line={line} page={page} surface={surface} headingFont={headingFont} dark={dark} mix={mix} />
        ))}
      </div>
    </div>
  );
}

/** The site's header as its look sits it: a centred masthead with small-caps links (editorial), a bar in the colour
 * (bold), dark glass with the accent on the current page (cinematic), underlines (split), pills (classic). */
function Header({
  look,
  name,
  primary,
  accent,
  ink,
  muted,
  line,
  page,
  headingFont,
  radius,
}: {
  look: LookId;
  name: string;
  primary: string;
  accent: string;
  ink: string;
  muted: string;
  line: string;
  page: string;
  headingFont?: string;
  radius: string;
}) {
  const links = ["Home", "About", "Contact"];
  if (look === "editorial") {
    return (
      <div className="flex flex-col items-center gap-1 border-b px-3 py-2 text-center" style={{ borderColor: line }}>
        <span className="text-[9px] font-bold tracking-tight" style={{ color: ink, fontFamily: headingFont }}>
          {name}
        </span>
        <span className="flex items-center gap-2 text-[4.5px] font-semibold uppercase tracking-[0.22em]" style={{ color: muted }}>
          {links.map((l, i) => (
            <span key={l} className="border-b pb-0.5" style={i === 0 ? { color: ink, borderColor: accent } : { borderColor: "transparent" }}>
              {l}
            </span>
          ))}
        </span>
      </div>
    );
  }
  if (look === "bold") {
    return (
      <div className="flex items-center justify-between px-3 py-2 text-white" style={{ background: primary }}>
        <span className="truncate text-[8px] uppercase tracking-wide" style={{ fontFamily: headingFont }}>
          {name}
        </span>
        <span className="flex items-center gap-1.5 text-[5px] font-bold uppercase tracking-[0.12em] text-white/85">
          {links.map((l, i) => (
            <span key={l} className="px-1.5 py-0.5" style={i === 0 ? { background: "#0a0a0a", color: "#ffffff", borderRadius: radius } : undefined}>
              {l}
            </span>
          ))}
        </span>
      </div>
    );
  }
  if (look === "cinematic") {
    return (
      <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-3 py-2 text-white">
        <span className="truncate text-[8px] font-bold tracking-tight" style={{ fontFamily: headingFont }}>
          {name}
        </span>
        <span className="flex items-center gap-2 text-[6px] font-medium text-white/70">
          {links.map((l, i) => (
            <span key={l} className={i === 0 ? "underline decoration-1 underline-offset-2" : ""} style={i === 0 ? { color: accent } : undefined}>
              {l}
            </span>
          ))}
        </span>
      </div>
    );
  }
  // Classic and split share the bar; classic marks the page with a pill, split with an underline.
  return (
    <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: line, background: page }}>
      <span className="truncate text-[8px] font-bold tracking-tight" style={{ color: ink, fontFamily: headingFont }}>
        {name}
      </span>
      <span className="flex items-center gap-2 text-[6px] font-medium" style={{ color: muted }}>
        {links.map((l, i) =>
          look === "split" ? (
            <span key={l} className="border-b pb-0.5" style={i === 0 ? { color: primary, borderColor: primary } : { borderColor: "transparent" }}>
              {l}
            </span>
          ) : (
            <span key={l} className="px-1.5 py-0.5 font-semibold" style={i === 0 ? { background: primary, color: "#ffffff", borderRadius: radius } : undefined}>
              {l}
            </span>
          )
        )}
      </span>
    </div>
  );
}

/** One of the sections after the banner, drawn the way its look draws it. */
function Section({
  block,
  look,
  primary,
  accent,
  ink,
  muted,
  line,
  page,
  surface,
  headingFont,
  dark,
  mix,
}: {
  block: StarterBlock;
  look: LookId;
  primary: string;
  accent: string;
  ink: string;
  muted: string;
  line: string;
  page: string;
  surface: string;
  headingFont?: string;
  dark: boolean;
  mix: (pct: number, base: string) => string;
}) {
  switch (block.type) {
    case "stats": {
      const items = ((block.config as StatsBlockConfig).items ?? []).slice(0, 3);
      if (look === "editorial") {
        return (
          <p className="flex items-center justify-center gap-2 px-3 pt-2 text-[6px]" style={{ color: ink, fontFamily: headingFont }}>
            {items.map((s, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span style={{ color: accent }}>·</span>}
                <span>
                  <b style={{ color: accent }}>{s.value}</b> {s.label.toLowerCase()}
                </span>
              </span>
            ))}
          </p>
        );
      }
      if (look === "bold") {
        return (
          <div className="mt-2 grid grid-cols-3 divide-x divide-white/15" style={{ background: ink, color: page }}>
            {items.map((s, i) => (
              <div key={i} className="px-1 py-1.5 text-center">
                <p className="truncate text-[10px] leading-none" style={{ fontFamily: headingFont }}>
                  {s.value}
                </p>
                <p className="mt-0.5 truncate text-[4.5px] uppercase tracking-wider opacity-70">{s.label}</p>
              </div>
            ))}
          </div>
        );
      }
      return (
        <div className="grid grid-cols-3 gap-1.5 px-2.5 pt-2">
          {items.map((s, i) => (
            <div key={i} className={`rounded-md px-1 py-1.5 text-center ${look === "cinematic" ? "ring-1 ring-white/10" : ""}`} style={{ background: surface }}>
              <p className="truncate text-[8px] font-extrabold tracking-tight" style={{ color: look === "cinematic" ? accent : primary }}>
                {s.value}
              </p>
              <p className="truncate text-[4.5px] font-medium uppercase tracking-wide" style={{ color: muted }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      );
    }
    case "gallery":
      // The live gallery is three square tiles across on a laptop; two rows of them read as the photo grid they are
      // (shorter than square so both rows fit the card).
      return (
        <div className="grid grid-cols-3 gap-1 px-2.5 pt-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-5 rounded-md" style={{ background: `linear-gradient(135deg, ${mix(45 - (i % 3) * 8, dark ? "#1a1a1a" : "white")}, ${mix(18 + (i >= 3 ? 10 : 0), dark ? "#111" : "white")})` }} />
          ))}
        </div>
      );
    case "product_list":
      return (
        <div className="grid grid-cols-3 gap-1.5 px-2.5 pt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded-md" style={{ background: `linear-gradient(135deg, ${mix(45 - i * 8, dark ? "#1a1a1a" : "white")}, ${mix(18, dark ? "#111" : "white")})` }} />
          ))}
        </div>
      );
    case "image_text": {
      const c = block.config as ImageTextBlockConfig;
      return (
        <div className="grid grid-cols-5 gap-2 px-3 pt-2.5">
          <div className="col-span-3">
            <p className="line-clamp-1 text-[7px] font-bold" style={{ color: ink, fontFamily: headingFont }}>
              {c.heading}
            </p>
            <div className="mt-1 space-y-0.5">
              <div className="h-[3px] w-full rounded-full" style={{ background: line }} />
              <div className="h-[3px] w-5/6 rounded-full" style={{ background: line }} />
              <div className="h-[3px] w-2/3 rounded-full" style={{ background: line }} />
            </div>
          </div>
          <div className="col-span-2 h-9 rounded-md" style={{ background: surface }} />
        </div>
      );
    }
    case "quote": {
      const q = (block.config as QuoteBlockConfig).quote;
      return (
        <p
          className={`px-4 pt-2.5 text-center leading-snug ${look === "bold" ? "text-[7px] font-bold uppercase tracking-tight" : "text-[6.5px] italic"}`}
          style={{ color: look === "editorial" ? accent : ink, fontFamily: headingFont }}
        >
          “{q}”
        </p>
      );
    }
    default:
      return (
        <div className="space-y-1 px-3 pt-2.5">
          <div className="h-[4px] w-1/2 rounded-full" style={{ background: ink, opacity: 0.8 }} />
          <div className="h-[3px] w-full rounded-full" style={{ background: line }} />
          <div className="h-[3px] w-4/5 rounded-full" style={{ background: line }} />
        </div>
      );
  }
}
