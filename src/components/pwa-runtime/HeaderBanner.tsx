import type { HeaderBanner as HeaderBannerConfig } from "@/lib/pwa/header-banner";
import type { ReactNode } from "react";

export function HeaderBanner({ banner, corner }: { banner: HeaderBannerConfig; corner?: ReactNode }) {
  const label = banner.label?.trim();
  const title = banner.title.trim();
  const sub = banner.sub?.trim();
  const button = banner.button?.trim();

  return (
    <div className="relative">
      <a href={banner.url} target="_blank" rel="noopener noreferrer" className="block rounded-2xl bg-[#f2a33a] px-3.5 py-3.5 text-[#1d1424]">
        {(label || corner) && <span className={`block truncate text-[11px] font-bold uppercase tracking-wide text-[#4a2a05]${corner ? " min-h-10 pr-24" : ""}`}>{label}</span>}
        <span className="mt-1 block text-[26px] font-extrabold leading-[1.08]">{title}</span>
        {sub && <span className="mt-1 block text-[13px] font-medium leading-snug text-[#4a2a05]">{sub}</span>}
        {button && <span className="mt-3 block rounded-full bg-[#1d1424] px-4 py-2.5 text-center text-sm font-bold text-[#ffe9c2]">{button}</span>}
      </a>
      {corner && <div className="absolute right-2.5 top-2.5">{corner}</div>}
    </div>
  );
}
