"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Fuel,
  Loader2,
  Mic,
  Plus,
  ShoppingBag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { STARTER_TEMPLATES, type StarterTemplate, type TemplateIcon } from "@/lib/apps/templates";

const ICONS: Record<TemplateIcon, LucideIcon> = {
  briefcase: Briefcase,
  "shopping-bag": ShoppingBag,
  calendar: CalendarDays,
  utensils: UtensilsCrossed,
  fuel: Fuel,
  mic: Mic,
  plus: Plus,
};

const NAME_HINTS: Record<string, string> = {
  business: "Maple Street Bakery",
  store: "Corner Shop",
  events: "Sunday Supper Club",
  food: "Eats near me",
  gas: "Cheap gas",
  openmic: "Open mics tonight",
  blank: "My app",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function NewAppForm({ organizationId, rootDomain }: { organizationId: string; rootDomain: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<StarterTemplate | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, name, slug: slugify(name), template: selected.id }),
    });
    const body = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(body.error ?? "Something went wrong");
      return;
    }

    router.push(`/dashboard/apps/${body.app.id}/builder`);
  }

  if (selected) {
    const Icon = ICONS[selected.icon];
    return (
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setError(null);
          }}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
        >
          <ArrowLeft className="h-4 w-4" /> Pick a different starter
        </button>
        <div className="rounded-3xl bg-white p-7 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-9">
          <div className="flex items-center gap-4">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${selected.color}, color-mix(in oklab, ${selected.color} 55%, #0a0a0a))` }}
            >
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Starting from</p>
              <h2 className="truncate text-xl font-semibold tracking-tight">{selected.name}</h2>
            </div>
          </div>

          <label htmlFor="app-name" className="mt-7 block text-sm font-semibold">
            What&apos;s it called?
          </label>
          <input
            id="app-name"
            required
            autoFocus
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={NAME_HINTS[selected.id] ?? "My app"}
            className="mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base outline-none transition focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5"
          />
          <p className="mt-2 min-h-5 text-sm text-neutral-500">
            {slugify(name) ? (
              <>
                Your app will live at <span className="font-medium text-neutral-950">{slugify(name)}.{rootDomain}</span>
              </>
            ) : (
              "This becomes your app's web address. You can change the name later."
            )}
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !slugify(name)}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-neutral-950 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Setting up your app…
              </>
            ) : (
              <>
                Create app <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {STARTER_TEMPLATES.map((t) => {
        const Icon = ICONS[t.icon];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t)}
            className="group flex flex-col rounded-3xl bg-white p-6 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lg transition group-hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${t.color}, color-mix(in oklab, ${t.color} 55%, #0a0a0a))` }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-5 text-lg font-semibold tracking-tight">{t.name}</h2>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-500">{t.tagline}</p>
            <div className="mt-4 flex min-h-6 flex-wrap gap-1.5">
              {t.includes.length ? (
                t.includes.map((chip) => (
                  <span key={chip} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                    {chip}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">Empty page</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
