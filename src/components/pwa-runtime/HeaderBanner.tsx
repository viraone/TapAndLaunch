import type { HeaderBanner as HeaderBannerConfig } from "@/lib/pwa/header-banner";

export function HeaderBanner({ banner }: { banner: HeaderBannerConfig }) {
  const label = banner.label?.trim();
  const title = banner.title.trim();
  const sub = banner.sub?.trim();
  const button = banner.button?.trim();

  return (
    <a href={banner.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#f2a33a] px-3 py-2 text-[#1d1424]">
      <span className="min-w-0 flex-1">
        {label && <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-[#4a2a05]">{label}</span>}
        <span className="block text-[15px] font-extrabold leading-tight">{title}</span>
        {sub && <span className="block text-[11px] font-medium leading-snug text-[#4a2a05]">{sub}</span>}
      </span>
      {button && <span className="shrink-0 rounded-full bg-[#1d1424] px-2.5 py-1.5 text-[11px] font-bold text-[#ffe9c2]">{button}</span>}
    </a>
  );
}
