import { websiteStyleOf, type StarterPage } from "@/lib/apps/templates";
import { themeStyle } from "@/lib/pwa/theme-style";
import type { HeroBlockConfig, QuoteBlockConfig, StatsBlockConfig, ThemeConfig } from "@/types/database";

/**
 * A website starter as a tiny real site in its own flavour, not a wireframe: the site's name in a menu, the banner's
 * actual eyebrow, headline and button, the real highlight numbers, the trade's tiles — set in the site's real fonts,
 * on its real light or dark page, with its real button shape. The flavour is read from the theme the site will
 * actually have (`websiteStyleOf`), so the card never promises a look the site doesn't deliver.
 */
export function WebsiteMockup({ home, theme, name, color }: { home: StarterPage | undefined; theme: ThemeConfig; name: string; color: string }) {
  const style = websiteStyleOf(theme);
  const blocks = home?.blocks ?? [];
  const hero = blocks.find((b) => b.type === "hero")?.config as HeroBlockConfig | undefined;
  const stats = ((blocks.find((b) => b.type === "stats")?.config as StatsBlockConfig | undefined)?.items ?? []).slice(0, 3);
  const quote = (blocks.find((b) => b.type === "quote")?.config as QuoteBlockConfig | undefined)?.quote;
  const tiles = blocks.some((b) => b.type === "gallery" || b.type === "product_list");
  const vars = themeStyle(theme);
  const headingFont = vars["--font-heading"];
  const bodyFont = vars.fontFamily;
  const radius = vars["--button-radius"] ?? "9999px";
  const tint = (pct: number, base = "white") => `color-mix(in oklab, ${color} ${pct}%, ${base})`;
  const tileRow = (
    <div className="grid grid-cols-3 gap-1.5 px-2.5 pt-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-7 rounded-md" style={{ background: `linear-gradient(135deg, ${tint(45 - i * 8)}, ${tint(18)})` }} />
      ))}
    </div>
  );
  const button = (cls: string, bg: string, fg: string) => (
    <span className={`inline-block px-2 py-0.5 text-[5px] font-bold ${cls}`} style={{ background: bg, color: fg, borderRadius: radius }}>
      {hero?.button_label ?? "Get in touch"}
    </span>
  );

  // ── Cinematic: a dark site, the colour used as light. Photography, Music, Technology.
  if (style === "cinematic") {
    // A dark brand colour (Photography's slate) is no light at all on a black page; mixing in white keeps the
    // eyebrow and the numbers legible while leaving a bright colour almost as it is.
    const light = tint(65);
    return (
      <Backdrop background={`radial-gradient(120% 100% at 85% 0%, ${tint(55, "#000")} 0%, #000 65%)`} glow={color} glowClass="-left-10 -top-10 opacity-60">
        <Window bg="#0b0b0d" chrome="#18181b" ring="ring-white/10">
          <Nav name={name} color={color} ink="#f5f5f5" muted="#a3a3a3" font={bodyFont} radius={radius} />
          <div className="relative px-3 pb-3 pt-4" style={{ background: `linear-gradient(135deg, ${tint(55, "#0b0b0d")}, #0b0b0d 85%)` }}>
            {hero?.eyebrow && (
              <p className="mb-1 text-[5px] font-bold uppercase tracking-[0.25em]" style={{ color: light }}>
                {hero.eyebrow}
              </p>
            )}
            <p className="line-clamp-2 text-[12px] font-bold leading-[1.05] tracking-tight text-white" style={{ fontFamily: headingFont }}>
              {hero?.headline}
            </p>
            {button("mt-2", tint(80), "#ffffff")}
          </div>
          {stats.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 px-2.5 pt-2.5">
              {stats.map((s, i) => (
                <div key={i} className="rounded-md bg-white/[0.06] px-1 py-1.5 text-center ring-1 ring-white/10">
                  <p className="truncate text-[8px] font-bold" style={{ color: light, fontFamily: headingFont }}>
                    {s.value}
                  </p>
                  <p className="truncate text-[4.5px] uppercase tracking-wide text-neutral-400">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          {tiles && tileRow}
        </Window>
      </Backdrop>
    );
  }

  // ── Editorial: serif headlines on warm paper, the quote right under the banner. Weddings, Art, Beauty.
  if (style === "editorial") {
    return (
      <Backdrop background={`linear-gradient(160deg, ${tint(18, "#f3ece0")}, #ebe3d4)`} glow={color} glowClass="-right-12 -bottom-16 opacity-40">
        <Window bg="#fdfaf4" chrome="#f0eadf" ring="ring-black/10">
          <Nav name={name} color={color} ink="#1c1917" muted="#78716c" font={headingFont} radius={radius} />
          <div className="px-4 pb-3 pt-3 text-center">
            {hero?.eyebrow && (
              <p className="mb-1 text-[5px] font-semibold uppercase tracking-[0.3em]" style={{ color }}>
                {hero.eyebrow}
              </p>
            )}
            <p className="mx-auto line-clamp-2 text-[13px] font-bold leading-[1.1] text-[#1c1917]" style={{ fontFamily: headingFont }}>
              {hero?.headline}
            </p>
            <div className="mx-auto mt-1.5 h-px w-8" style={{ background: color }} />
            {quote && (
              <p className="mt-1.5 line-clamp-1 text-[6px] italic text-[#57534e]" style={{ fontFamily: headingFont }}>
                “{quote}”
              </p>
            )}
            {button("mt-2", "transparent", "#1c1917")}
          </div>
          {stats.length > 0 && (
            <p className="flex items-center justify-center gap-2 px-3 text-[6px] text-[#44403c]" style={{ fontFamily: headingFont }}>
              {stats.map((s, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span style={{ color }}>·</span>}
                  <span>
                    <b>{s.value}</b> {s.label.toLowerCase()}
                  </span>
                </span>
              ))}
            </p>
          )}
          {tiles && tileRow}
        </Window>
      </Backdrop>
    );
  }

  // ── Bold: poster headlines in a condensed face, square corners, the colour everywhere. Construction, Marketing, Travel.
  if (style === "bold") {
    return (
      <Backdrop background={`linear-gradient(135deg, ${color}, ${tint(70, "#0a0a0a")})`} glow="#ffffff" glowClass="-right-16 -top-16 opacity-20">
        <Window bg="#fffdf7" chrome="#f3f1ea" ring="ring-black/10">
          <Nav name={name} color={color} ink="#0a0a0a" muted="#525252" font={bodyFont} radius={radius} />
          <div className="relative px-3 pb-3 pt-3" style={{ background: color }}>
            {hero?.eyebrow && <p className="mb-0.5 text-[5px] font-bold uppercase tracking-[0.25em] text-white/80">{hero.eyebrow}</p>}
            <p className="line-clamp-2 text-[18px] uppercase leading-[0.95] tracking-wide text-white" style={{ fontFamily: headingFont }}>
              {hero?.headline}
            </p>
            {button("mt-2", "#0a0a0a", "#ffffff")}
          </div>
          {stats.length > 0 && (
            <div className="grid grid-cols-3 divide-x divide-white/15 bg-neutral-950">
              {stats.map((s, i) => (
                <div key={i} className="px-1 py-1.5 text-center">
                  <p className="truncate text-[10px] leading-none text-white" style={{ fontFamily: headingFont }}>
                    {s.value}
                  </p>
                  <p className="mt-0.5 truncate text-[4.5px] uppercase tracking-wider" style={{ color: tint(60) }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )}
          {tiles && tileRow}
        </Window>
      </Backdrop>
    );
  }

  // ── Split: the headline beside the work. Design, Apparel.
  if (style === "split") {
    return (
      <Backdrop background={`linear-gradient(160deg, ${tint(24)}, ${tint(6, "#eef0f8")})`} glow={color} glowClass="-left-12 -bottom-16 opacity-35">
        <Window bg="#ffffff" chrome="#f1f1f4" ring="ring-black/10">
          <Nav name={name} color={color} ink="#0a0a0a" muted="#737373" font={bodyFont} radius={radius} />
          <div className="grid grid-cols-5 gap-2 px-3 pb-2 pt-2">
            <div className="col-span-3">
              {hero?.eyebrow && (
                <p className="mb-1 text-[5px] font-semibold uppercase tracking-[0.2em]" style={{ color }}>
                  {hero.eyebrow}
                </p>
              )}
              <p className="line-clamp-3 text-[12px] leading-[1.05] text-[#0a0a0a]" style={{ fontFamily: headingFont }}>
                {hero?.headline}
              </p>
              {button("mt-2", color, "#ffffff")}
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-square rounded-md" style={{ background: `linear-gradient(135deg, ${tint(50 - i * 9)}, ${tint(14)})` }} />
              ))}
            </div>
          </div>
          {stats.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 px-2.5 pt-1">
              {stats.map((s, i) => (
                <div key={i} className="rounded-md px-1 py-1.5 text-center" style={{ background: tint(8, "#f6f6fb") }}>
                  <p className="truncate text-[8px] font-bold" style={{ color, fontFamily: headingFont }}>
                    {s.value}
                  </p>
                  <p className="truncate text-[4.5px] uppercase tracking-wide text-neutral-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </Window>
      </Backdrop>
    );
  }

  // ── Classic: clean and direct. Personal website, Education, Consulting, Health, Real estate.
  return (
    <Backdrop background={`radial-gradient(140% 120% at 10% 20%, ${tint(55, "#0a0a0a")} 0%, ${tint(18, "#0a0a0a")} 100%)`} glow={color} glowClass="-right-8 -top-12 opacity-50">
      <Window bg="#ffffff" chrome="#f5f5f5" ring="ring-white/15">
        <Nav name={name} color={color} ink="#0a0a0a" muted="#737373" font={bodyFont} radius={radius} />
        <div className="relative px-3 pb-2.5 pt-3" style={{ background: color }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
          <div className="relative">
            {hero?.eyebrow && <p className="mb-1 text-[5px] font-bold uppercase tracking-[0.2em] text-white/80">{hero.eyebrow}</p>}
            <p className="line-clamp-2 text-[11px] font-extrabold leading-[1.05] tracking-tight text-white" style={{ fontFamily: headingFont }}>
              {hero?.headline ?? "Your headline"}
            </p>
            {button("mt-2", "#ffffff", "#0a0a0a")}
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
        {tiles && tileRow}
      </Window>
    </Backdrop>
  );
}

// The mockup fills its card edge to edge, like a screenshot of the real site: no gradient backdrop, no browser frame.
// (`background`, `glow`, `chrome` and `ring` are still passed by each flavour; the page itself is what shows now.)
function Backdrop({ children }: { background: string; glow: string; glowClass: string; children: React.ReactNode }) {
  return (
    <div aria-hidden className="relative h-full w-full overflow-hidden">
      {children}
    </div>
  );
}

function Window({ bg, children }: { bg: string; chrome: string; ring: string; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: bg }}>
      {/* Zoomed so the site's few sections fill the frame the way a real screenshot of the top of a site would. */}
      <div style={{ zoom: 1.5 }}>{children}</div>
    </div>
  );
}

function Nav({ name, color, ink, muted, font, radius }: { name: string; color: string; ink: string; muted: string; font?: string; radius: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="truncate text-[8px] font-bold tracking-tight" style={{ color: ink, fontFamily: font }}>
        {name}
      </span>
      <span className="flex items-center gap-2 text-[6px] font-medium" style={{ color: muted }}>
        <span className="px-1.5 py-0.5 font-semibold text-white" style={{ background: color, borderRadius: radius }}>
          Home
        </span>
        <span>About</span>
        <span>Contact</span>
      </span>
    </div>
  );
}
