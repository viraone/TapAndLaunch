import { Globe, Mail, Music2 } from "lucide-react";

type IconProps = { className?: string; "aria-hidden"?: boolean | "true" };
/** The brand marks, drawn here (the icon library carries no brand icons). */
const Instagram = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
  </svg>
);
const Youtube = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="2.5" y="5" width="19" height="14" rx="4" />
    <path d="M10 9.5v5l4.5-2.5L10 9.5Z" fill="currentColor" stroke="none" />
  </svg>
);
const Facebook = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M14 3h3v4h-3a1 1 0 0 0-1 1v3h4l-.5 4H13v7h-4v-7H6v-4h3V8a5 5 0 0 1 5-5Z" />
  </svg>
);
import type { ThemeConfig } from "@/types/database";

/** The places a site can point to from its footer, with the icon drawn for each (TikTok and X get their name). */
export const SOCIAL_KINDS: Record<string, { label: string; icon?: (props: IconProps) => React.ReactNode }> = {
  instagram: { label: "Instagram", icon: Instagram },
  tiktok: { label: "TikTok", icon: Music2 },
  youtube: { label: "YouTube", icon: Youtube },
  facebook: { label: "Facebook", icon: Facebook },
  x: { label: "X" },
  email: { label: "Email", icon: Mail },
  website: { label: "Website", icon: Globe },
};

const SAFE = /^(https?:\/\/|mailto:)/i;

/** The bottom of every page: a line of text (copyright, where to find you) and the social links. */
export function SiteFooter({ theme }: { theme: ThemeConfig }) {
  const text = theme.footer?.text?.trim();
  const links = (theme.footer?.social ?? []).filter((l) => l.url?.trim());
  if (!text && links.length === 0) return null;
  return (
    <footer className="mt-auto border-t border-border/70 px-5 py-8 text-center @lg:py-12">
      {links.length > 0 && (
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {links.map((link, i) => {
            const kind = SOCIAL_KINDS[link.kind] ?? { label: link.kind };
            const Icon = kind.icon;
            const raw = link.url.trim();
            const href = link.kind === "email" && !SAFE.test(raw) ? `mailto:${raw}` : SAFE.test(raw) ? raw : `https://${raw}`;
            return (
              <li key={i}>
                <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-muted/60 px-4 text-sm font-semibold ring-1 ring-border transition [&:hover]:bg-muted">
                  {Icon ? <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> : <span className="font-bold text-primary">𝕏</span>}
                  {kind.label}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {text && <p className={`text-sm text-muted-foreground ${links.length ? "mt-5" : ""}`}>{text}</p>}
    </footer>
  );
}
