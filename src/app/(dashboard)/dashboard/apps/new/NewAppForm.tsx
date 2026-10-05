"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Dumbbell,
  Fuel,
  Loader2,
  Mic,
  Plus,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import { STARTER_TEMPLATES, TEMPLATE_CATEGORIES, templateNeedsMaps, type StarterTemplate, type TemplateIcon } from "@/lib/apps/templates";
import { slugify } from "@/lib/apps/slug";
import { MAX_DESCRIPTION, MIN_DESCRIPTION } from "@/lib/ai/app-spec";
import { TemplatePreview } from "@/components/dashboard/TemplatePreview";

const ICONS: Record<TemplateIcon, LucideIcon> = {
  briefcase: Briefcase,
  "shopping-bag": ShoppingBag,
  calendar: CalendarDays,
  utensils: UtensilsCrossed,
  fuel: Fuel,
  mic: Mic,
  plus: Plus,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  users: Users,
};

const NAME_HINTS: Record<string, string> = {
  business: "Maple Street Bakery",
  store: "Corner Shop",
  events: "Sunday Supper Club",
  food: "Eats near me",
  gas: "Cheap gas",
  openmic: "Open mics tonight",
  blank: "My app",
  restaurant: "Taco Loco",
  fitness: "Flow Yoga Studio",
  salon: "Bloom Hair Studio",
  community: "Ballard Neighbors",
};

const EXAMPLES = [
  "A taco truck with a menu, catering requests and our weekly pop-up schedule",
  "A yoga studio where people can see classes, book a spot and try a free class",
  "A neighbourhood book club with upcoming meetups and a way to join",
];

export function NewAppForm({ organizationId, rootDomain, mapsEnabled }: { organizationId: string; rootDomain: string; mapsEnabled: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<StarterTemplate | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [description, setDescription] = useState("");
  const [describeName, setDescribeName] = useState("");
  const [designing, setDesigning] = useState(false);
  const [describeError, setDescribeError] = useState<string | null>(null);

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

  async function handleDescribe(e: React.FormEvent) {
    e.preventDefault();
    setDesigning(true);
    setDescribeError(null);
    try {
      const res = await fetch("/api/apps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: organizationId, description, name: describeName || undefined }),
      });
      const body = (await res.json()) as { app?: { id: string }; error?: string };
      if (!res.ok || !body.app) {
        setDescribeError(body.error ?? "Something went wrong. Try again, or pick a template below.");
        setDesigning(false);
        return;
      }
      router.push(`/dashboard/apps/${body.app.id}/builder`);
    } catch {
      setDescribeError("Something went wrong. Try again, or pick a template below.");
      setDesigning(false);
    }
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
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
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

  const ready = description.trim().length >= MIN_DESCRIPTION;

  return (
    <div className="space-y-12">
      <form
        onSubmit={handleDescribe}
        className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-8"
      >
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">Describe your app</h2>
            <p className="mt-0.5 text-sm text-neutral-500">Tell us about it in a sentence or two and we&apos;ll build a first version for you to change.</p>
          </div>
        </div>

        <label htmlFor="describe" className="sr-only">
          Describe your app
        </label>
        <textarea
          id="describe"
          rows={3}
          maxLength={MAX_DESCRIPTION}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={designing}
          placeholder="For example: a taco truck with a menu, catering requests and our weekly pop-up schedule"
          className="mt-5 w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5 disabled:opacity-60"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={designing}
              onClick={() => setDescription(example)}
              className="min-h-11 rounded-full bg-neutral-100 px-4 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-200 disabled:opacity-60 sm:min-h-9"
            >
              {example.length > 52 ? `${example.slice(0, 50)}…` : example}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="describe-name" className="block text-sm font-medium text-neutral-800">
              Name <span className="font-normal text-neutral-500">(optional, we&apos;ll suggest one)</span>
            </label>
            <input
              id="describe-name"
              maxLength={60}
              value={describeName}
              onChange={(e) => setDescribeName(e.target.value)}
              disabled={designing}
              placeholder="Taco Loco"
              className="mt-1.5 h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base outline-none transition focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5 disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={!ready || designing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110 disabled:opacity-50"
          >
            {designing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Designing your app…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Build my app
              </>
            )}
          </button>
        </div>
        {designing && <p className="mt-3 text-sm text-neutral-500">This takes about 10 seconds. You&apos;ll land in the builder, where you can change anything.</p>}
        {describeError && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {describeError}
          </p>
        )}
      </form>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">Or start from a template</h2>
        <p className="mt-1 text-sm text-neutral-500">Every one comes filled in. You can preview it right away and change anything.</p>
      </div>

      {TEMPLATE_CATEGORIES.map((category) => {
        // Templates that need live maps data (Food finder, Gas prices) only appear for accounts that have maps switched
        // on; everyone else never sees them, and a group left empty is hidden.
        const templates = STARTER_TEMPLATES.filter((t) => t.category === category.id && (mapsEnabled || !templateNeedsMaps(t.id)));
        if (templates.length === 0) return null;
        return (
          <section key={category.id} aria-labelledby={`cat-${category.id}`} className="-mt-6">
            <h3 id={`cat-${category.id}`} className="text-lg font-semibold tracking-tight text-neutral-950">
              {category.name}
            </h3>
            <p className="text-sm text-neutral-500">{category.blurb}</p>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => {
                const Icon = ICONS[t.icon];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t)}
                    className="group relative flex flex-col rounded-3xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 enabled:hover:-translate-y-1 enabled:hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.28)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    <TemplatePreview templateId={t.id} color={t.color} />
                    <div className="flex items-center gap-3 px-2 pt-4">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow transition group-hover:scale-105"
                        style={{ background: `linear-gradient(135deg, ${t.color}, color-mix(in oklab, ${t.color} 55%, #0a0a0a))` }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <h4 className="text-base font-semibold tracking-tight">{t.name}</h4>
                    </div>
                    <p className="mt-1.5 flex-1 px-2 text-sm leading-relaxed text-neutral-500">
                      {t.tagline}
                    </p>
                    <div className="mt-3 flex min-h-6 flex-wrap gap-1.5 px-2 pb-2">
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
          </section>
        );
      })}
    </div>
  );
}
