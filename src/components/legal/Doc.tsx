import Link from "next/link";
import { BRAND, LEGAL_NAME, SUPPORT_EMAIL } from "@/lib/legal";

export const LEGAL_PAGES = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/support", label: "Support" },
];

/** Small links to every legal page; used under the landing page and on each legal page. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap justify-center gap-x-5 gap-y-1 ${className}`}>
      {LEGAL_PAGES.map((p) => (
        <Link key={p.href} href={p.href} className="underline-offset-4 hover:text-neutral-200 hover:underline">
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

export function Doc({ title, updated, intro, children }: { title: string; updated?: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {updated && <p className="mt-2 text-sm text-neutral-500">Last updated {updated}</p>}
      {intro && <p className="mt-6 text-base leading-relaxed text-neutral-300">{intro}</p>}
      <div className="mt-8 space-y-8">{children}</div>
      <p className="mt-12 border-t border-white/10 pt-6 text-sm text-neutral-500">
        {BRAND} is operated by {LEGAL_NAME}, Seattle, Washington. Questions? Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-neutral-300 underline underline-offset-4">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-neutral-50">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-neutral-300">{children}</div>
    </section>
  );
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-neutral-600">{children}</ul>;
}
