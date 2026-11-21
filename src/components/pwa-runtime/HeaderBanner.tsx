import type { HeaderBanner as HeaderBannerConfig } from "@/lib/pwa/header-banner";
import { Fragment, type ReactNode } from "react";

const WEEKDAYS: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

// "Fri Nov 27, 7:30 PM" -> ["Friday", "Nov", "27", "7:30 PM"]. Anything that does not match is returned whole, as one part.
export function splitShowDate(detail: string): string[] {
  const m = /^([A-Za-z]{3})[A-Za-z]*\.?\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(.+)$/.exec(detail.trim());
  if (!m) return [detail.trim()];
  const weekday = WEEKDAYS[m[1].toLowerCase()] ?? m[1];
  return [weekday, m[2], m[3], m[4].trim()];
}

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
  // "Get Tickets · Fri Nov 27, 7:30 PM": the action on top, the details under it in smaller type.
  const [buttonMain, ...buttonRest] = (buttonText ?? "").split(" · ");
  const buttonDetail = buttonRest.join(" · ");
  const big = banner.big?.trim();
  const image = banner.image?.trim();
  const chips = (banner.chips ?? []).filter((chip) => chip.text.trim());
  const fullBleed = Boolean(image) && !label && chips.length === 0;
  // A full-width image banner puts the ticket button above the picture; every other layout keeps it at the bottom.
  const buttonOnTop = fullBleed && Boolean(buttonText);

  const pillTone = buttonOnTop ? "mx-3.5 mb-2 mt-3.5 bg-white" : `bg-[#1d1424] shadow-[0_4px_0_#7a3f0a,0_8px_16px_rgba(0,0,0,0.3)] ${image ? "mt-3" : "mt-4"}`;
  const buttonEl = buttonText ? (
    <span className={`relative flex items-center justify-between rounded-full py-1.5 pl-5 pr-1.5 ${pillTone}`}>
      <span className={`flex items-center gap-2.5 pr-2 text-[15.5px] leading-tight tracking-tight ${buttonOnTop ? "text-[19px] font-extrabold text-black" : "font-bold text-white"}`}>
        <svg width={buttonOnTop ? 26 : 20} height={buttonOnTop ? 26 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" />
          <path d="M14 6v12" strokeDasharray="2 2" />
        </svg>
        <span className="flex flex-col">
          <span className={buttonDetail ? (buttonOnTop ? "text-[12.5px] font-semibold text-[#3b2a45]/80" : "text-[12.5px] font-semibold text-white/75") : undefined}>{buttonMain}</span>
          {buttonDetail && <span className={`mt-0.5 leading-tight tracking-normal font-extrabold ${buttonOnTop ? "text-[19px] text-black" : "text-[17px] text-white"}`}>{buttonDetail}</span>}
        </span>
      </span>
      <span className="relative flex size-[42px] shrink-0 items-center justify-center">
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[#e8442a] opacity-60 motion-safe:animate-ping" />
        <span className="relative flex size-[42px] items-center justify-center rounded-full bg-[#e8442a] text-white">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </span>
      </span>
    </span>
  ) : null;

  return (
    <div className="relative">
      <a href={banner.url} target="_blank" rel="noopener noreferrer" className={`relative block ${buttonOnTop ? "text-[#1d1424]" : `overflow-hidden rounded-3xl bg-[linear-gradient(155deg,#ffbe55_0%,#f2a33a_45%,#e8862a_100%)] text-[#1d1424] ${fullBleed ? "" : image ? "p-3.5" : "px-[18px] pb-4 pt-[18px]"}`}`}>
        {big && !image && (
          <span aria-hidden="true" className="pointer-events-none absolute -right-1.5 top-[58px] select-none text-[150px] font-extrabold leading-none tracking-[-0.06em] text-white/30">
            {big}
          </span>
        )}
        {!fullBleed && (label || corner) && (
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
            <img src={image} alt={title} width={1173} height={552} decoding="async" className={fullBleed ? `relative block h-auto w-full${buttonOnTop ? " rounded-3xl" : ""}` : "relative mt-3 block h-auto w-full rounded-2xl ring-1 ring-black/10"} />
          </>
        )}
        {buttonOnTop && buttonDetail && (
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[60%] whitespace-nowrap inline-flex items-center gap-2 rounded-full bg-black/55 px-[18px] py-[7px] text-[14px] min-[360px]:text-[16px] font-semibold uppercase leading-none tracking-[0.16em] text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] ring-1 ring-white/20 backdrop-blur-md">
            {splitShowDate(buttonDetail).map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden="true" className="size-[4px] shrink-0 rounded-full bg-[#e8442a]" />}
                <span className={i === 0 ? "font-extrabold" : undefined}>{part}</span>
              </Fragment>
            ))}
          </span>
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
        {!buttonOnTop && buttonEl}
      </a>
      {corner && <div className="absolute right-2.5 top-2.5">{corner}</div>}
    </div>
  );
}
