import type { HeaderBanner as HeaderBannerConfig } from "@/lib/pwa/header-banner";
import { Fragment, type ReactNode } from "react";

export function HeaderBanner({ banner, corner }: { banner: HeaderBannerConfig; corner?: ReactNode }) {
  const label = banner.label?.trim();
  const title = banner.title.trim();
  const sub = banner.sub?.trim();
  const button = banner.button?.trim();
  const buttonText = button ? button.replace(/\s*[→>]+\s*$/, "").trim() || button : undefined;
  const subParts = sub ? sub.split(" · ") : [];

  return (
    <div className="relative">
      <a href={banner.url} target="_blank" rel="noopener noreferrer" className="block rounded-3xl bg-[#f2a33a] px-[18px] pb-3.5 pt-[18px] text-[#1d1424]">
        {(label || corner) && <span className={`block truncate text-[14px] font-bold uppercase tracking-[0.1em] text-[#4a2a05]${corner ? (label ? " pr-12" : " min-h-10 pr-12") : ""}`}>{label}</span>}
        <span className={`${label || corner ? "mt-5 " : ""}block text-[34px] font-extrabold leading-none tracking-[-0.035em]`}>{title}</span>
        {sub && (
          <span className="mt-2.5 block text-[13.5px] font-medium leading-snug text-[#4a2a05]">
            {subParts.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {part}
              </Fragment>
            ))}
          </span>
        )}
        {buttonText && (
          <span className="mt-4 flex items-center justify-between border-t border-[#1d1424]/20 pt-3">
            <span className="text-[15px] font-bold tracking-tight">{buttonText}</span>
            <span className="flex size-[38px] items-center justify-center rounded-full bg-[#1d1424] text-[#ffe9c2]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
