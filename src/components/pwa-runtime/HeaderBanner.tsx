import type { HeaderBanner as HeaderBannerConfig } from "@/lib/pwa/header-banner";
import { Fragment, type ReactNode } from "react";

const CHIP_ICONS = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
};

export function HeaderBanner({ banner, corner }: { banner: HeaderBannerConfig; corner?: ReactNode }) {
  const label = banner.label?.trim();
  const title = banner.title.trim();
  const sub = banner.sub?.trim();
  const button = banner.button?.trim();
  const buttonText = button ? button.replace(/\s*[→>]+\s*$/, "").trim() || button : undefined;
  const subParts = sub ? sub.split(" · ") : [];
  const big = banner.big?.trim();
  const image = banner.image?.trim();
  const chips = (banner.chips ?? []).filter((chip) => chip.text.trim());

  return (
    <div className="relative">
      <a href={banner.url} target="_blank" rel="noopener noreferrer" className={`relative block overflow-hidden rounded-3xl bg-[linear-gradient(155deg,#ffbe55_0%,#f2a33a_45%,#e8862a_100%)] text-[#1d1424] ${image ? "p-3.5" : "px-[18px] pb-4 pt-[18px]"}`}>
        {big && !image && (
          <span aria-hidden="true" className="pointer-events-none absolute -right-1.5 top-[58px] select-none text-[150px] font-extrabold leading-none tracking-[-0.06em] text-white/30">
            {big}
          </span>
        )}
        {(label || corner) && (
          <span className={`relative block${corner ? (label ? " pr-12" : " min-h-10 pr-12") : ""}`}>
            {label && (
              <span className="inline-block max-w-full truncate rounded-full bg-white px-3 py-1.5 align-top text-[12.5px] font-bold uppercase tracking-[0.1em] text-[#1d1424]">
                <span aria-hidden="true" className="mr-[7px] inline-block size-[7px] rounded-full bg-[#e8442a] align-[1px]" />
                {label}
              </span>
            )}
          </span>
        )}
        {image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={title} width={1200} height={1142} decoding="async" className="relative mt-3 block h-auto w-full rounded-2xl ring-1 ring-black/10" />
          </>
        )}
        <span className={image ? "sr-only" : `${label || corner ? "mt-5 " : ""}relative block text-[34px] font-extrabold leading-none tracking-[-0.035em]`}>{title}</span>
        {sub && !image && (
          <span className="relative mt-2.5 block text-[13.5px] font-medium leading-snug text-[#4a2a05]">
            {subParts.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {part}
              </Fragment>
            ))}
          </span>
        )}
        {chips.length > 0 && (
          <span className={`relative flex flex-wrap gap-2 ${image ? "mt-3" : "mt-3.5"}`}>
            {chips.map((chip, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1424]/90 px-[11px] py-1.5 text-[12.5px] font-semibold text-white">
                {chip.icon && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {CHIP_ICONS[chip.icon]}
                  </svg>
                )}
                {chip.text.trim()}
              </span>
            ))}
          </span>
        )}
        {buttonText && (
          <span className={`relative flex items-center justify-between rounded-full bg-[#1d1424] py-1.5 pl-5 pr-1.5 ${image ? "mt-3" : "mt-4"}`}>
            <span className="text-[15.5px] font-bold tracking-tight text-white">{buttonText}</span>
            <span className="flex size-[42px] items-center justify-center rounded-full bg-white text-[#1d1424]">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </span>
          </span>
        )}
      </a>
      {corner && <div className="absolute right-2.5 top-2.5">{corner}</div>}
    </div>
  );
}
